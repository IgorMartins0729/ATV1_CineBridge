import type { IRegistroAuditoria, RegistroAuditoria } from '../../application/ports/ICanaisNotificacao.js';
import type { ILogger } from '../../application/ports/ILogger.js';

/** Grava cada registro como log estruturado (JSON) e mantém uma cópia consultável em memória. */
export class RegistroAuditoriaLog implements IRegistroAuditoria {
    private readonly registros: RegistroAuditoria[] = [];
    private readonly logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    public async registrar(registro: RegistroAuditoria): Promise<void> {
        this.registros.push(registro);
        this.logger.info('auditoria', { auditoria: registro });
    }

    public async listar(): Promise<RegistroAuditoria[]> {
        return [...this.registros];
    }
}
