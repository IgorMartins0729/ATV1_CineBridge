import type { Profissional } from '../../domain/entities/Profissional.js';
import type { Projeto } from '../../domain/entities/Projeto.js';
import type { Ranking } from '../../domain/entities/Recomendacao.js';
import type { Papel } from '../../domain/enums/Papel.js';
import { rankearPorPapel } from './rankear.js';
import type { RecomendacaoStrategy } from './RecomendacaoStrategy.js';

export interface ConfigRegrasOrcamento {
    topN: number;
    /** Multiplicador da verba do papel aceito como teto (1 = não pode passar da verba). */
    tolerancia: number;
    pesoEconomia: number;
    pesoQualidade: number;
    pesoProximidade: number;
    /** Se ninguém couber na verba, mantém os N mais baratos para o papel não ficar vazio. */
    minimoCandidatos: number;
}

export const CONFIG_ORCAMENTO_PADRAO: ConfigRegrasOrcamento = {
    topN: 5,
    tolerancia: 1,
    pesoEconomia: 0.5,
    pesoQualidade: 0.3,
    pesoProximidade: 0.2,
    minimoCandidatos: 3
};

/**
 * Regras de negócio para projetos com orçamento reduzido:
 * cada papel tem uma verba proporcional ao seu peso; quem cobra mais que a verba é descartado;
 * entre os que cabem, ganha quem é mais barato, bem avaliado e perto do local de filmagem (menos custo de viagem).
 */
export class RegrasOrcamento implements RecomendacaoStrategy {
    readonly nome = 'regras-orcamento';
    readonly descricao = 'Regras de negócio para orçamento reduzido: verba por papel, preço, avaliação e proximidade';
    private readonly config: ConfigRegrasOrcamento;

    constructor(config: Partial<ConfigRegrasOrcamento> = {}) {
        this.config = { ...CONFIG_ORCAMENTO_PADRAO, ...config };
    }

    public recomendar(
        projeto: Projeto,
        profissionais: readonly Profissional[],
        papeis: readonly Papel[] = projeto.getPapeis()
    ): Ranking {
        const ranking: Ranking = new Map();
        for (const papel of papeis) {
            const teto = projeto.verbaDoPapel(papel) * this.config.tolerancia;
            const doPapel = profissionais.filter((p) => p.possuiEspecialidade(papel));
            let cabem = doPapel.filter((p) => p.getPrecoMedio() <= teto);
            if (cabem.length === 0) {
                cabem = [...doPapel]
                    .sort((a, b) => a.getPrecoMedio() - b.getPrecoMedio())
                    .slice(0, this.config.minimoCandidatos);
            }
            const parcial = rankearPorPapel(cabem, [papel], this.config.topN, (profissional) =>
                this.pontuar(projeto, profissional, teto)
            );
            ranking.set(papel, parcial.get(papel) ?? []);
        }
        return ranking;
    }

    private pontuar(projeto: Projeto, profissional: Profissional, teto: number): number {
        const economia = teto > 0 ? 1 - Math.min(1, profissional.getPrecoMedio() / teto) : 0;
        const qualidade = profissional.mediaAvaliacoes() / 5;
        const local = profissional.getLocalizacao();
        const proximidade = local.mesmaCidade(projeto.getLocalizacao())
            ? 1
            : local.mesmoEstado(projeto.getLocalizacao())
              ? 0.5
              : 0;
        const { pesoEconomia, pesoQualidade, pesoProximidade } = this.config;
        return pesoEconomia * economia + pesoQualidade * qualidade + pesoProximidade * proximidade;
    }
}
