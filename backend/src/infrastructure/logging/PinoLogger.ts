import type { Logger } from 'pino';
import type { ContextoLog, ILogger } from '../../application/ports/ILogger.js';

/** Adapta o logger do pino (o mesmo do Fastify) para a interface da aplicação. */
export class PinoLogger implements ILogger {
    private readonly pino: Logger;

    constructor(pino: Logger) {
        this.pino = pino;
    }

    public info(mensagem: string, contexto: ContextoLog = {}): void {
        this.pino.info(contexto, mensagem);
    }

    public warn(mensagem: string, contexto: ContextoLog = {}): void {
        this.pino.warn(contexto, mensagem);
    }

    public error(mensagem: string, contexto: ContextoLog = {}): void {
        this.pino.error(contexto, mensagem);
    }
}
