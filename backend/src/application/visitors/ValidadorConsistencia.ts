import type { Profissional } from '../../domain/entities/Profissional.js';
import type { Projeto } from '../../domain/entities/Projeto.js';
import { rotuloPapel } from '../../domain/enums/Papel.js';
import type { VisitanteProjeto } from '../../domain/visitors/VisitanteProjeto.js';
import { formatarMoeda } from './formatacao.js';

/**
 * Visitante que verifica a consistência do projeto: papéis obrigatórios preenchidos,
 * orçamento suficiente e membros aptos (especialidade e disponibilidade no prazo).
 */
export class ValidadorConsistencia implements VisitanteProjeto<boolean> {
    private problemas: string[] = [];
    private projetoAtual: Projeto | null = null;

    public getProblemas(): readonly string[] {
        return this.problemas;
    }

    public visitarProjeto(projeto: Projeto): boolean {
        this.problemas = [];
        const equipe = projeto.getEquipe();
        if (!equipe) {
            this.problemas.push('o projeto ainda não tem equipe');
            return false;
        }

        for (const papel of projeto.getPapeis()) {
            if (!equipe.obterMembro(papel)) {
                this.problemas.push(`papel obrigatório sem profissional: ${rotuloPapel(papel)}`);
            }
        }
        if (equipe.custoTotal() > projeto.getOrcamento()) {
            this.problemas.push(
                `custo da equipe (${formatarMoeda(equipe.custoTotal())}) passa do orçamento (${formatarMoeda(projeto.getOrcamento())})`
            );
        }

        this.projetoAtual = projeto;
        try {
            for (const membro of equipe.getMembros()) {
                membro.getProfissional().aceitar(this);
            }
        } finally {
            this.projetoAtual = null;
        }
        return this.problemas.length === 0;
    }

    public visitarProfissional(profissional: Profissional): boolean {
        const antes = this.problemas.length;
        const nome = profissional.getNome();
        if (profissional.getCompetencias().length === 0) {
            this.problemas.push(`${nome} não tem competências cadastradas`);
        }

        const projeto = this.projetoAtual;
        const membro = projeto
            ?.getEquipe()
            ?.getMembros()
            .find((m) => m.getProfissional().getId() === profissional.getId());
        if (projeto && membro) {
            if (!profissional.possuiEspecialidade(membro.getPapel())) {
                this.problemas.push(`${nome} não tem especialidade em ${rotuloPapel(membro.getPapel())}`);
            }
            if (!profissional.estaDisponivelEm(projeto.getPrazo())) {
                this.problemas.push(`${nome} não está disponível na data de entrega`);
            }
        }
        return this.problemas.length === antes;
    }
}
