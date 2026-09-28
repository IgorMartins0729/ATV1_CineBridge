import type { ContextoLog, ILogger } from '../../application/ports/ILogger.js';

export interface EntradaLog {
    nivel: 'info' | 'warn' | 'error';
    mensagem: string;
    contexto: ContextoLog;
}

/** Logger que só guarda as entradas em memória. Útil em testes e no script de demonstração. */
export class LoggerMemoria implements ILogger {
    private readonly entradas: EntradaLog[] = [];

    public info(mensagem: string, contexto: ContextoLog = {}): void {
        this.entradas.push({ nivel: 'info', mensagem, contexto });
    }

    public warn(mensagem: string, contexto: ContextoLog = {}): void {
        this.entradas.push({ nivel: 'warn', mensagem, contexto });
    }

    public error(mensagem: string, contexto: ContextoLog = {}): void {
        this.entradas.push({ nivel: 'error', mensagem, contexto });
    }

    public getEntradas(): readonly EntradaLog[] {
        return this.entradas;
    }
}
