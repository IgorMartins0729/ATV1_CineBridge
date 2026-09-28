import type { Equipe } from '../../domain/entities/Equipe.js';
import type { Projeto } from '../../domain/entities/Projeto.js';
import { Recomendacao } from '../../domain/entities/Recomendacao.js';
import { criarEvento, TipoEvento, type Evento, type ResumoProfissional } from '../eventos/EventoRecomendacao.js';
import type { OpcoesOrquestracao, OrquestradorEquipe } from '../orquestrador/OrquestradorEquipe.js';
import type { IEventBus } from '../ports/IEventBus.js';
import type { IRecomendacaoRepository } from '../ports/IRecomendacaoRepository.js';
import type { OrigemDados, ProvedorProfissionais } from '../services/ProvedorProfissionais.js';
import type { RecomendacaoStrategy } from '../strategies/RecomendacaoStrategy.js';
import type { RegistroEstrategias } from '../strategies/RegistroEstrategias.js';
import type { Observador } from './Observador.js';

export interface DependenciasSistema {
    orquestrador: OrquestradorEquipe;
    provedor: ProvedorProfissionais;
    estrategias: RegistroEstrategias;
    eventBus: IEventBus;
    recomendacoes: IRecomendacaoRepository;
}

export interface ResultadoRecomendacao {
    recomendacao: Recomendacao;
    sugestoes: Equipe[];
    parcial: boolean;
    origemDados: OrigemDados;
}

const ORIGEM = 'SistemaRecomendacao';

/**
 * Sujeito do padrão Observer e ponto de entrada do motor de recomendação.
 * Guarda a estratégia atual (Strategy), usa o orquestrador (Template Method)
 * e avisa os observadores a cada recomendação gerada.
 */
export class SistemaRecomendacao {
    private readonly deps: DependenciasSistema;
    private readonly observadores = new Map<Observador, () => void>();
    private estrategiaAtual: RecomendacaoStrategy | null = null;

    constructor(deps: DependenciasSistema) {
        this.deps = deps;
    }

    /** Estratégia usada para projetos que não escolheram uma. Aceita a instância ou o nome. */
    public definirEstrategia(estrategia: RecomendacaoStrategy | string): void {
        this.estrategiaAtual = typeof estrategia === 'string' ? this.deps.estrategias.obter(estrategia) : estrategia;
    }

    /** Busca uma estratégia pelo nome (lança ValidacaoError se não existir). */
    public obterEstrategia(nome: string): RecomendacaoStrategy {
        return this.deps.estrategias.obter(nome);
    }

    public getEstrategiaAtual(): RecomendacaoStrategy | null {
        return this.estrategiaAtual;
    }

    /** Ordem: estratégia do projeto > estratégia definida no sistema > escolha automática pelo orçamento. */
    public resolverEstrategia(projeto: Projeto): RecomendacaoStrategy {
        const doProjeto = projeto.getEstrategia();
        if (doProjeto) {
            return this.deps.estrategias.obter(doProjeto);
        }
        return this.estrategiaAtual ?? this.deps.estrategias.selecionarAutomatica(projeto);
    }

    public adicionarObservador(observador: Observador): void {
        if (this.observadores.has(observador)) return;
        const cancelar = this.deps.eventBus.assinar('*', (evento) => observador.atualizar(evento));
        this.observadores.set(observador, cancelar);
    }

    public removerObservador(observador: Observador): void {
        this.observadores.get(observador)?.();
        this.observadores.delete(observador);
    }

    public getObservadores(): string[] {
        return [...this.observadores.keys()].map((o) => o.nome);
    }

    public async notificarObservadores(evento: Evento): Promise<void> {
        await this.deps.eventBus.publicar(evento);
    }

    public async executarRecomendacao(
        projeto: Projeto,
        opcoes: OpcoesOrquestracao = {}
    ): Promise<ResultadoRecomendacao> {
        const estrategia = this.resolverEstrategia(projeto);
        const papeis = opcoes.papeis ?? projeto.getPapeis();
        const excluidos = [...(opcoes.excluidos ?? [])];

        const busca = await this.deps.provedor.buscar({
            papeis,
            disponivelEm: projeto.getPrazo(),
            precoMaximo: projeto.getOrcamento(),
            excluirIds: excluidos
        });
        const resultado = this.deps.orquestrador.orquestrar(projeto, busca.profissionais, estrategia, {
            ...opcoes,
            papeis,
            excluidos
        });

        const parcial = busca.parcial || resultado.papeisSemCandidatos.length > 0;
        const recomendacao = new Recomendacao({
            projetoId: projeto.getId(),
            estrategia: estrategia.nome,
            ranking: resultado.ranking,
            parcial,
            papeisSemCandidatos: resultado.papeisSemCandidatos
        });
        await this.deps.recomendacoes.salvar(recomendacao);

        await this.notificarObservadores(
            criarEvento(
                TipoEvento.RECOMENDACAO_GERADA,
                {
                    recomendacaoId: recomendacao.getId(),
                    projetoId: projeto.getId(),
                    titulo: projeto.getTitulo(),
                    produtor: projeto.getProdutor(),
                    estrategia: estrategia.nome,
                    parcial,
                    papeis: [...papeis],
                    recomendados: this.recomendados(resultado.sugestoes, opcoes)
                },
                ORIGEM
            )
        );

        return { recomendacao, sugestoes: resultado.sugestoes, parcial, origemDados: busca.origem };
    }

    /** Profissionais novos que aparecem nas sugestões (os fixos já foram avisados antes). */
    private recomendados(sugestoes: readonly Equipe[], opcoes: OpcoesOrquestracao): ResumoProfissional[] {
        const fixos = new Set([...(opcoes.fixos?.values() ?? [])].map((p) => p.getId()));
        const resumo = new Map<string, ResumoProfissional>();
        for (const equipe of sugestoes) {
            for (const membro of equipe.getMembros()) {
                const p = membro.getProfissional();
                if (fixos.has(p.getId()) || resumo.has(p.getId())) continue;
                resumo.set(p.getId(), { id: p.getId(), nome: p.getNome(), email: p.getEmail(), papel: membro.getPapel() });
            }
        }
        return [...resumo.values()];
    }
}
