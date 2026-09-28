import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import type { Container } from '../../config/container.js';
import { registrarRotasGerais } from './rotas/rotasGerais.js';
import { registrarRotasProjetos } from './rotas/rotasProjetos.js';
import { tratarErro } from './tratadorErros.js';

export interface OpcoesApp {
    /** Logger pino compartilhado com a aplicação. Sem ele, o Fastify não gera logs (útil nos testes). */
    logger?: Logger;
}

/** Cria a aplicação HTTP sem abrir porta (o server.ts faz o listen; os testes usam app.inject). */
export function buildApp(container: Container, opcoes: OpcoesApp = {}): FastifyInstance {
    const app: FastifyInstance = opcoes.logger
        ? Fastify({ loggerInstance: opcoes.logger as FastifyBaseLogger, requestIdHeader: 'x-request-id' })
        : Fastify({ logger: false });

    app.setErrorHandler(tratarErro);
    registrarRotasGerais(app, container);
    registrarRotasProjetos(app, container);
    return app;
}
