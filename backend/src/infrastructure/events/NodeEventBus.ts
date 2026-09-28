import { EventEmitter } from 'node:events';
import type { Evento, TipoEvento } from '../../application/eventos/EventoRecomendacao.js';
import type { IEventBus, ManipuladorEvento } from '../../application/ports/IEventBus.js';
import type { ILogger } from '../../application/ports/ILogger.js';

const TODOS = '*';

/**
 * Barramento em memória com o EventEmitter do Node.
 * Cada assinante roda isolado: se um lançar erro, o erro é registrado e os demais continuam.
 */
export class NodeEventBus implements IEventBus {
    private readonly emissor = new EventEmitter();
    private readonly logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
        this.emissor.setMaxListeners(0);
    }

    public assinar(tipo: TipoEvento | '*', manipulador: ManipuladorEvento): () => void {
        const ouvinte = (evento: Evento, pendentes: Promise<void>[]): void => {
            pendentes.push(
                Promise.resolve()
                    .then(() => manipulador(evento))
                    .catch((erro: unknown) => {
                        this.logger.error('Falha em assinante de evento', {
                            tipo: evento.tipo,
                            erro: erro instanceof Error ? erro.message : String(erro)
                        });
                    })
            );
        };
        this.emissor.on(tipo, ouvinte);
        return () => {
            this.emissor.off(tipo, ouvinte);
        };
    }

    public async publicar(evento: Evento): Promise<void> {
        const pendentes: Promise<void>[] = [];
        this.emissor.emit(evento.tipo, evento, pendentes);
        this.emissor.emit(TODOS, evento, pendentes);
        await Promise.all(pendentes);
    }
}
