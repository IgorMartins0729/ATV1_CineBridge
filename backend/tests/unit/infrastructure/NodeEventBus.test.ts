import { describe, expect, it } from 'vitest';
import { criarEvento, TipoEvento, type Evento } from '../../../src/application/eventos/EventoRecomendacao.js';
import { Papel } from '../../../src/domain/enums/Papel.js';
import { NodeEventBus } from '../../../src/infrastructure/events/NodeEventBus.js';
import { LoggerMemoria } from '../../../src/infrastructure/logging/LoggerMemoria.js';

function eventoSubstituicao(): Evento {
    return criarEvento(
        TipoEvento.MEMBRO_SUBSTITUIDO,
        { projetoId: 'p', papel: Papel.EDITOR, motivo: 'SUBSTITUICAO', anteriorId: null, novo: null },
        'teste'
    );
}

describe('NodeEventBus', () => {
    it('entrega o evento aos assinantes do tipo e aos assinantes de todos (*)', async () => {
        const bus = new NodeEventBus(new LoggerMemoria());
        const recebidos: string[] = [];
        bus.assinar(TipoEvento.MEMBRO_SUBSTITUIDO, () => {
            recebidos.push('tipo');
        });
        bus.assinar(TipoEvento.EQUIPE_FORMADA, () => {
            recebidos.push('outro-tipo');
        });
        bus.assinar('*', (evento) => {
            recebidos.push(`todos:${evento.tipo}`);
        });

        await bus.publicar(eventoSubstituicao());
        expect(recebidos).toEqual(['tipo', 'todos:MEMBRO_SUBSTITUIDO']);
    });

    it('isola falhas: um assinante com erro não impede os outros', async () => {
        const logger = new LoggerMemoria();
        const bus = new NodeEventBus(logger);
        let chamadasOk = 0;
        bus.assinar('*', () => {
            throw new Error('falhou síncrono');
        });
        bus.assinar('*', async () => {
            throw new Error('falhou assíncrono');
        });
        bus.assinar('*', () => {
            throw 'erro sem Error';
        });
        bus.assinar('*', () => {
            chamadasOk++;
        });

        await expect(bus.publicar(eventoSubstituicao())).resolves.toBeUndefined();
        expect(chamadasOk).toBe(1);
        expect(logger.getEntradas().filter((e) => e.nivel === 'error')).toHaveLength(3);
    });

    it('aguarda assinantes assíncronos e permite cancelar a assinatura', async () => {
        const bus = new NodeEventBus(new LoggerMemoria());
        let concluido = false;
        const cancelar = bus.assinar('*', async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            concluido = true;
        });
        await bus.publicar(eventoSubstituicao());
        expect(concluido).toBe(true);

        concluido = false;
        cancelar();
        await bus.publicar(eventoSubstituicao());
        expect(concluido).toBe(false);
    });
});
