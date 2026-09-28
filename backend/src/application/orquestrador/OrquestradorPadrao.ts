import type { Profissional } from '../../domain/entities/Profissional.js';
import type { Projeto } from '../../domain/entities/Projeto.js';
import type { Ranking } from '../../domain/entities/Recomendacao.js';
import { OrquestradorEquipe, type ConfigOrquestrador } from './OrquestradorEquipe.js';

export interface ConfigOrquestradorPadrao extends ConfigOrquestrador {
    /** Relógio injetável, para os testes não dependerem da data atual. */
    relogio: () => Date;
}

export class OrquestradorPadrao extends OrquestradorEquipe {
    private readonly relogio: () => Date;

    constructor(config: Partial<ConfigOrquestradorPadrao> = {}) {
        super({ quantidadeSugestoes: config.quantidadeSugestoes ?? 3 });
        this.relogio = config.relogio ?? (() => new Date());
    }

    protected validarRestricoes(projeto: Projeto): string[] {
        const problemas: string[] = [];
        if (projeto.getPrazo() <= this.relogio()) {
            problemas.push('a data de entrega precisa ser futura');
        }
        if (projeto.estaFormada()) {
            problemas.push('a equipe do projeto já foi formada');
        }
        const menorVerba = Math.min(...projeto.getPapeis().map((papel) => projeto.verbaDoPapel(papel)));
        if (menorVerba < 1) {
            problemas.push('orçamento insuficiente para dividir entre os papéis');
        }
        return problemas;
    }

    /** Remove duplicados e quem não pode participar: sem papel no projeto, indisponível no prazo ou mais caro que o orçamento. */
    protected normalizarDados(projeto: Projeto, profissionais: readonly Profissional[]): Profissional[] {
        const papeis = new Set(projeto.getPapeis());
        const prazo = projeto.getPrazo();
        const orcamento = projeto.getOrcamento();
        const vistos = new Set<string>();
        return profissionais.filter((profissional) => {
            if (vistos.has(profissional.getId())) return false;
            vistos.add(profissional.getId());
            return (
                profissional.getEspecialidades().some((papel) => papeis.has(papel)) &&
                profissional.estaDisponivelEm(prazo) &&
                profissional.getPrecoMedio() <= orcamento
            );
        });
    }

    /** Descarta pontuação zero (sem nenhuma aderência) mantendo a ordem da estratégia. */
    protected posProcessar(_projeto: Projeto, ranking: Ranking): Ranking {
        return new Map([...ranking].map(([papel, lista]) => [papel, lista.filter((c) => c.pontuacao > 0)]));
    }
}
