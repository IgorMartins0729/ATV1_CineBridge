import type { Evento } from '../eventos/EventoRecomendacao.js';
import type { IRegistroAuditoria } from '../ports/ICanaisNotificacao.js';
import type { Observador } from './Observador.js';

/** Registra todos os eventos (ações de produtores e profissionais) como log estruturado de auditoria. */
export class AuditoriaRecomendacao implements Observador {
    readonly nome = 'AuditoriaRecomendacao';
    private readonly registro: IRegistroAuditoria;

    constructor(registro: IRegistroAuditoria) {
        this.registro = registro;
    }

    public async atualizar(evento: Evento): Promise<void> {
        await this.registro.registrar({
            tipo: evento.tipo,
            origem: evento.origem,
            ocorridoEm: evento.ocorridoEm.toISOString(),
            dados: evento.dados
        });
    }
}
