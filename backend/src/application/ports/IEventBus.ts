import type { Evento, TipoEvento } from '../eventos/EventoRecomendacao.js';

export type ManipuladorEvento = (evento: Evento) => void | Promise<void>;

/**
 * Barramento de eventos. Hoje é implementado com EventEmitter (NodeEventBus);
 * pode ser trocado por RabbitMQ sem mudar nenhuma regra de negócio.
 */
export interface IEventBus {
    /** Publica o evento e aguarda os assinantes. Falha de um assinante não afeta os outros. */
    publicar(evento: Evento): Promise<void>;

    /** Assina um tipo de evento ('*' = todos). Retorna a função que cancela a assinatura. */
    assinar(tipo: TipoEvento | '*', manipulador: ManipuladorEvento): () => void;
}
