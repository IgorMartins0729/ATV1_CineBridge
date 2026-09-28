import type { Evento } from '../eventos/EventoRecomendacao.js';

/** Observer: reage aos eventos publicados pelo SistemaRecomendacao. */
export interface Observador {
    readonly nome: string;
    atualizar(evento: Evento): void | Promise<void>;
}
