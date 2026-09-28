import {
    COMPETENCIA_POR_CAPTACAO,
    PERFIS_POR_PAPEL,
    type PerfilCompetencias
} from '../../domain/catalogo/perfisCompetencia.js';
import type { Profissional } from '../../domain/entities/Profissional.js';
import type { Projeto } from '../../domain/entities/Projeto.js';
import type { Ranking } from '../../domain/entities/Recomendacao.js';
import type { Papel } from '../../domain/enums/Papel.js';
import { rankearPorPapel } from './rankear.js';
import type { RecomendacaoStrategy } from './RecomendacaoStrategy.js';

export interface ConfigSimilaridadeCosseno {
    topN: number;
    /**
     * O cosseno só mede a "direção" do vetor (um perfil 1-1-1 é igual a 10-10-10).
     * Este peso mistura o nível absoluto das competências na nota final (0 = só cosseno).
     */
    pesoMagnitude: number;
    /** Nível ideal na competência do tipo de captação (documentário/ficção/animação). */
    nivelIdealCaptacao: number;
    perfis: Readonly<Record<Papel, PerfilCompetencias>>;
}

export const CONFIG_COSSENO_PADRAO: ConfigSimilaridadeCosseno = {
    topN: 5,
    pesoMagnitude: 0.3,
    nivelIdealCaptacao: 8,
    perfis: PERFIS_POR_PAPEL
};

export function similaridadeCosseno(a: readonly number[], b: readonly number[]): number {
    let produto = 0;
    let normaA = 0;
    let normaB = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const x = a[i] ?? 0;
        const y = b[i] ?? 0;
        produto += x * y;
        normaA += x * x;
        normaB += y * y;
    }
    if (normaA === 0 || normaB === 0) {
        return 0;
    }
    return produto / (Math.sqrt(normaA) * Math.sqrt(normaB));
}

/** Compara o vetor de competências do profissional com o perfil ideal do papel. */
export class SimilaridadeCosseno implements RecomendacaoStrategy {
    readonly nome = 'similaridade-cosseno';
    readonly descricao = 'Similaridade de cosseno entre o vetor de competências e o perfil ideal do papel';
    private readonly config: ConfigSimilaridadeCosseno;

    constructor(config: Partial<ConfigSimilaridadeCosseno> = {}) {
        this.config = { ...CONFIG_COSSENO_PADRAO, ...config };
    }

    public recomendar(
        projeto: Projeto,
        profissionais: readonly Profissional[],
        papeis: readonly Papel[] = projeto.getPapeis()
    ): Ranking {
        // O perfil ideal de cada papel é montado uma vez por chamada, não uma vez por profissional.
        const competenciaCaptacao = COMPETENCIA_POR_CAPTACAO[projeto.getTipoCaptacao()];
        const perfis = new Map(
            papeis.map((papel) => {
                const perfil = { ...this.config.perfis[papel], [competenciaCaptacao]: this.config.nivelIdealCaptacao };
                const dimensoes = Object.keys(perfil);
                const ideal = dimensoes.map((d) => perfil[d] ?? 0);
                return [papel, { dimensoes, ideal, somaIdeal: ideal.reduce((s, v) => s + v, 0) || 1 }];
            })
        );
        const peso = this.config.pesoMagnitude;

        return rankearPorPapel(profissionais, papeis, this.config.topN, (profissional, papel) => {
            const { dimensoes, ideal, somaIdeal } = perfis.get(papel)!;
            const real = profissional.vetorCompetencias(dimensoes);
            const cosseno = similaridadeCosseno(real, ideal);
            const magnitude = real.reduce((s, v) => s + v, 0) / somaIdeal;
            return (1 - peso) * cosseno + peso * Math.min(1, magnitude);
        });
    }
}
