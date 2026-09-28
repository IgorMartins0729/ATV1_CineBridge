export type ContextoLog = Record<string, unknown>;

/** Logger estruturado (JSON). Implementado com pino na infraestrutura. */
export interface ILogger {
    info(mensagem: string, contexto?: ContextoLog): void;
    warn(mensagem: string, contexto?: ContextoLog): void;
    error(mensagem: string, contexto?: ContextoLog): void;
}
