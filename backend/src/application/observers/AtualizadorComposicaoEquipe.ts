import type { Papel } from '../../domain/enums/Papel.js';
import { TipoEvento, type Evento } from '../eventos/EventoRecomendacao.js';
import type { Observador } from './Observador.js';

/** O que o observador precisa do serviço de equipe (depende da abstração, não da classe concreta). */
export interface ReacoesConvite {
    confirmarPresenca(projetoId: string, papel: Papel, profissionalId: string): Promise<void>;
    tratarRecusa(projetoId: string, papel: Papel, profissionalId: string): Promise<void>;
}

/**
 * Observa as respostas aos convites e atualiza a composição da equipe:
 * aceite -> confirma o membro (e forma a equipe quando todos confirmam);
 * recusa -> dispara nova rodada de recomendação para o papel.
 */
export class AtualizadorComposicaoEquipe implements Observador {
    readonly nome = 'AtualizadorComposicaoEquipe';
    private readonly reacoes: ReacoesConvite;

    constructor(reacoes: ReacoesConvite) {
        this.reacoes = reacoes;
    }

    public async atualizar(evento: Evento): Promise<void> {
        if (evento.tipo === TipoEvento.CONVITE_ACEITO) {
            const { projetoId, papel, profissional } = evento.dados;
            await this.reacoes.confirmarPresenca(projetoId, papel, profissional.id);
        } else if (evento.tipo === TipoEvento.CONVITE_RECUSADO) {
            const { projetoId, papel, profissional } = evento.dados;
            await this.reacoes.tratarRecusa(projetoId, papel, profissional.id);
        }
    }
}
