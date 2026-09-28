import type { Profissional } from '../../domain/entities/Profissional.js';
import type { Projeto } from '../../domain/entities/Projeto.js';
import type { Ranking } from '../../domain/entities/Recomendacao.js';
import type { Papel } from '../../domain/enums/Papel.js';
import { rankearPorPapel } from './rankear.js';
import type { RecomendacaoStrategy } from './RecomendacaoStrategy.js';

export interface ConfigFiltragemColaborativa {
    topN: number;
    /**
     * Quantas avaliações "fictícias" com a nota de referência entram na conta (média bayesiana).
     * Evita que alguém com uma única nota 5 passe na frente de quem tem vinte notas 4,8.
     */
    confiancaMinima: number;
    /** Nota neutra assumida para quem tem poucas avaliações (0 a 5). */
    notaReferencia: number;
    /** Peso da experiência em projetos do mesmo gênero. */
    pesoGenero: number;
    /** Peso da experiência no mesmo tipo de captação. */
    pesoTipoCaptacao: number;
}

export const CONFIG_COLABORATIVA_PADRAO: ConfigFiltragemColaborativa = {
    topN: 5,
    confiancaMinima: 3,
    notaReferencia: 3,
    pesoGenero: 0.2,
    pesoTipoCaptacao: 0.1
};

/**
 * Usa o histórico: avaliações que outros produtores deram (média bayesiana)
 * e a experiência do profissional em projetos parecidos com o atual.
 */
export class FiltragemColaborativa implements RecomendacaoStrategy {
    readonly nome = 'filtragem-colaborativa';
    readonly descricao = 'Avaliações históricas de outros produtores e experiência em projetos semelhantes';
    private readonly config: ConfigFiltragemColaborativa;

    constructor(config: Partial<ConfigFiltragemColaborativa> = {}) {
        this.config = { ...CONFIG_COLABORATIVA_PADRAO, ...config };
    }

    public recomendar(
        projeto: Projeto,
        profissionais: readonly Profissional[],
        papeis: readonly Papel[] = projeto.getPapeis()
    ): Ranking {
        const { confiancaMinima: c, notaReferencia, pesoGenero, pesoTipoCaptacao } = this.config;
        const pesoAvaliacoes = Math.max(0, 1 - pesoGenero - pesoTipoCaptacao);
        const genero = projeto.getGenero();
        const tipo = projeto.getTipoCaptacao();

        return rankearPorPapel(profissionais, papeis, this.config.topN, (profissional) => {
            const notas = profissional.getAvaliacoes();
            const soma = notas.reduce((s, a) => s + a.getNota(), 0);
            const quantidade = c + notas.length;
            const bayesiana = quantidade === 0 ? notaReferencia : (c * notaReferencia + soma) / quantidade;

            const historico = profissional.getHistoricoProjetos();
            const total = historico.length || 1;
            const mesmoGenero = historico.filter((h) => h.genero.toLowerCase() === genero).length;
            const mesmoTipo = historico.filter((h) => h.tipoCaptacao === tipo).length;

            return (
                pesoAvaliacoes * (bayesiana / 5) +
                pesoGenero * (mesmoGenero / total) +
                pesoTipoCaptacao * (mesmoTipo / total)
            );
        });
    }
}
