import { Equipe } from '../../domain/entities/Equipe.js';
import type { Profissional } from '../../domain/entities/Profissional.js';
import type { Projeto } from '../../domain/entities/Projeto.js';
import type { Ranking } from '../../domain/entities/Recomendacao.js';
import type { Papel } from '../../domain/enums/Papel.js';
import { RestricaoInvalidaError } from '../../domain/erros.js';
import type { RecomendacaoStrategy } from '../strategies/RecomendacaoStrategy.js';

export interface OpcoesOrquestracao {
    /** Papéis a recomendar (padrão: todos). Usado na nova rodada de um único papel. */
    papeis?: readonly Papel[];
    /** Profissionais que não podem ser recomendados (ex.: rejeitados pelo produtor). */
    excluidos?: Iterable<string>;
    /** Membros já escolhidos que devem ser mantidos fixos. */
    fixos?: ReadonlyMap<Papel, Profissional>;
}

export interface ResultadoOrquestracao {
    ranking: Ranking;
    /** Uma ou mais sugestões de equipe completa, da melhor para a pior. */
    sugestoes: Equipe[];
    papeisSemCandidatos: Papel[];
}

export interface ConfigOrquestrador {
    quantidadeSugestoes: number;
}

/**
 * Template Method: `orquestrar` define o esqueleto fixo do processo.
 * As subclasses implementam apenas as etapas variáveis (validar, normalizar, pós-processar).
 */
export abstract class OrquestradorEquipe {
    protected readonly config: ConfigOrquestrador;

    constructor(config: ConfigOrquestrador) {
        // TypeScript não tem "final": este teste impede que uma subclasse troque o fluxo principal.
        if (this.orquestrar !== OrquestradorEquipe.prototype.orquestrar) {
            throw new Error(`${new.target.name} não pode sobrescrever orquestrar(): o fluxo principal é fixo`);
        }
        this.config = config;
    }

    /** Método template: validar -> filtrar exclusões -> normalizar -> recomendar -> pós-processar -> montar. */
    public orquestrar(
        projeto: Projeto,
        profissionais: readonly Profissional[],
        estrategia: RecomendacaoStrategy,
        opcoes: OpcoesOrquestracao = {}
    ): ResultadoOrquestracao {
        const problemas = this.validarRestricoes(projeto);
        if (problemas.length > 0) {
            throw new RestricaoInvalidaError(problemas);
        }

        const papeis = opcoes.papeis ?? projeto.getPapeis();
        const fixos = opcoes.fixos ?? new Map<Papel, Profissional>();
        const bloqueados = new Set(opcoes.excluidos ?? []);
        for (const fixo of fixos.values()) bloqueados.add(fixo.getId());
        const permitidos =
            bloqueados.size === 0 ? profissionais : profissionais.filter((p) => !bloqueados.has(p.getId()));

        const normalizados = this.normalizarDados(projeto, permitidos);
        const ranking = estrategia.recomendar(projeto, normalizados, papeis);
        const final = this.posProcessar(projeto, ranking);

        return {
            ranking: final,
            sugestoes: this.montarSugestoes(projeto, papeis, final, fixos),
            papeisSemCandidatos: papeis.filter((papel) => (final.get(papel)?.length ?? 0) === 0)
        };
    }

    /** Retorna a lista de problemas encontrados (vazia = projeto válido). */
    protected abstract validarRestricoes(projeto: Projeto): string[];

    protected abstract normalizarDados(projeto: Projeto, profissionais: readonly Profissional[]): Profissional[];

    protected abstract posProcessar(projeto: Projeto, ranking: Ranking): Ranking;

    /**
     * Etapa fixa: monta N sugestões (sugestão k usa o k-ésimo melhor de cada papel),
     * sem repetir profissional e cabendo no orçamento sempre que possível.
     */
    private montarSugestoes(
        projeto: Projeto,
        papeis: readonly Papel[],
        ranking: Ranking,
        fixos: ReadonlyMap<Papel, Profissional>
    ): Equipe[] {
        const ordem = [...papeis].sort((a, b) => projeto.pesoDoPapel(b) - projeto.pesoDoPapel(a));
        const sugestoes: Equipe[] = [];
        const composicoesVistas = new Set<string>();

        for (let k = 0; k < this.config.quantidadeSugestoes; k++) {
            const escolhidos = new Map<Papel, Profissional>();
            const usados = new Set([...fixos.values()].map((p) => p.getId()));

            for (const papel of ordem) {
                const lista = ranking.get(papel) ?? [];
                const inicio = Math.min(k, Math.max(lista.length - 1, 0));
                const candidato =
                    lista.slice(inicio).find((c) => !usados.has(c.profissional.getId())) ??
                    lista.find((c) => !usados.has(c.profissional.getId()));
                if (candidato) {
                    escolhidos.set(papel, candidato.profissional);
                    usados.add(candidato.profissional.getId());
                }
            }

            this.ajustarAoOrcamento(projeto, [...ordem].reverse(), ranking, escolhidos, fixos);

            const chave = [...escolhidos].map(([papel, p]) => `${papel}:${p.getId()}`).sort().join('|');
            if (escolhidos.size === 0 || composicoesVistas.has(chave)) continue;
            composicoesVistas.add(chave);

            const equipe = new Equipe();
            for (const [papel, profissional] of fixos) equipe.definirMembro(papel, profissional);
            for (const [papel, profissional] of escolhidos) equipe.definirMembro(papel, profissional);
            sugestoes.push(equipe);
        }
        return sugestoes;
    }

    /** Enquanto passar do orçamento, troca por alguém mais barato começando pelos papéis de menor peso. */
    private ajustarAoOrcamento(
        projeto: Projeto,
        papeisMenorPesoPrimeiro: readonly Papel[],
        ranking: Ranking,
        escolhidos: Map<Papel, Profissional>,
        fixos: ReadonlyMap<Papel, Profissional>
    ): void {
        const custo = (): number =>
            [...fixos.values(), ...escolhidos.values()].reduce((total, p) => total + p.getPrecoMedio(), 0);

        let trocou = true;
        while (custo() > projeto.getOrcamento() && trocou) {
            trocou = false;
            const usados = new Set([...fixos.values(), ...escolhidos.values()].map((p) => p.getId()));
            for (const papel of papeisMenorPesoPrimeiro) {
                const atual = escolhidos.get(papel);
                if (!atual) continue;
                const maisBarato = (ranking.get(papel) ?? []).find(
                    (c) => !usados.has(c.profissional.getId()) && c.profissional.getPrecoMedio() < atual.getPrecoMedio()
                );
                if (maisBarato) {
                    escolhidos.set(papel, maisBarato.profissional);
                    trocou = true;
                    break;
                }
            }
        }
    }
}
