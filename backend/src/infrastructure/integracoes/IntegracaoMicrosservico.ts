import { TipoEvento, type Evento } from '../../application/eventos/EventoRecomendacao.js';
import type { ILogger } from '../../application/ports/ILogger.js';
import type { Observador } from '../../application/observers/Observador.js';

export interface MensagemIntegracao {
    destino: string;
    evento: TipoEvento;
    payload: unknown;
}

/**
 * Encaminha a equipe formada para outro microsservício (gerenciamento de projetos, financeiro...).
 * Aqui o envio é simulado com log; no futuro basta trocar por um publicador de fila (RabbitMQ).
 */
export class IntegracaoMicrosservico implements Observador {
    readonly nome: string;
    private readonly destino: string;
    private readonly logger: ILogger;
    private readonly enviados: MensagemIntegracao[] = [];

    constructor(destino: string, logger: ILogger) {
        this.destino = destino;
        this.nome = `Integracao:${destino}`;
        this.logger = logger;
    }

    public atualizar(evento: Evento): void {
        if (evento.tipo !== TipoEvento.EQUIPE_FORMADA) return;
        const mensagem = { destino: this.destino, evento: evento.tipo, payload: evento.dados };
        this.enviados.push(mensagem);
        this.logger.info('Evento enviado a outro microsserviço', {
            destino: this.destino,
            projetoId: evento.dados.projetoId
        });
    }

    public getEnviados(): readonly MensagemIntegracao[] {
        return this.enviados;
    }
}
