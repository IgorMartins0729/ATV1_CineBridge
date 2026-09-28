import type { Profissional } from '../../domain/entities/Profissional.js';
import type { Projeto } from '../../domain/entities/Projeto.js';
import type { VisitanteProjeto } from '../../domain/visitors/VisitanteProjeto.js';

/**
 * Visitante que calcula a compatibilidade geral da equipe com o projeto (0 a 100).
 * Cada membro recebe uma nota (avaliações, competências, proximidade e disponibilidade)
 * e a média é ponderada pelo peso do papel. Papel vazio conta como zero.
 */
export class CalculadorCompatibilidade implements VisitanteProjeto<number> {
    private projetoAtual: Projeto | null = null;

    public visitarProjeto(projeto: Projeto): number {
        const equipe = projeto.getEquipe();
        if (!equipe) return 0;

        this.projetoAtual = projeto;
        try {
            let soma = 0;
            for (const requisito of projeto.getPapeisObrigatorios()) {
                const membro = equipe.obterMembro(requisito.getPapel());
                soma += requisito.getPeso() * (membro ? membro.getProfissional().aceitar(this) : 0);
            }
            return Math.round((soma / projeto.somaPesos()) * 10) / 10;
        } finally {
            this.projetoAtual = null;
        }
    }

    public visitarProfissional(profissional: Profissional): number {
        const avaliacao = profissional.mediaAvaliacoes() / 5;
        const competencias = profissional.nivelMedioCompetencias() / 10;

        let proximidade = 0.5;
        let disponibilidade = 1;
        const projeto = this.projetoAtual;
        if (projeto) {
            const local = profissional.getLocalizacao();
            proximidade = local.mesmaCidade(projeto.getLocalizacao())
                ? 1
                : local.mesmoEstado(projeto.getLocalizacao())
                  ? 0.5
                  : 0;
            disponibilidade = profissional.estaDisponivelEm(projeto.getPrazo()) ? 1 : 0;
        }

        const nota = 0.35 * avaliacao + 0.35 * competencias + 0.15 * proximidade + 0.15 * disponibilidade;
        return Math.round(nota * 1000) / 10;
    }
}
