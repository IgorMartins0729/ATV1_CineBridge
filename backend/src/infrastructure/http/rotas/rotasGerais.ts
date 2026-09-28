import type { FastifyInstance } from 'fastify';
import type { Container } from '../../../config/container.js';
import { apresentarConvite } from '../apresentadores.js';
import { schemaConvitePorId, schemaRespostaConvite } from '../schemas.js';

export function registrarRotasGerais(app: FastifyInstance, container: Container): void {
    const { conviteService, estrategias, repositorios, canais, parametros } = container;

    app.get('/health', async () => ({
        status: 'ok',
        profissionaisCadastrados: await repositorios.profissionais.contar()
    }));

    app.get('/estrategias', async () => ({
        padrao: parametros.estrategias.selecao.padrao,
        orcamentoReduzido: {
            abaixoDe: parametros.estrategias.selecao.limiteOrcamentoReduzido,
            estrategia: parametros.estrategias.selecao.estrategiaOrcamentoReduzido
        },
        disponiveis: estrategias.listar().map((e) => ({ nome: e.nome, descricao: e.descricao }))
    }));

    app.get<{ Params: { id: string } }>('/convites/:id', { schema: schemaConvitePorId }, async (req) => {
        return apresentarConvite(await conviteService.buscar(req.params.id));
    });

    // Ação do profissional: aceitar ou recusar o convite.
    app.post<{ Params: { id: string }; Body: { aceito: boolean } }>(
        '/convites/:id/resposta',
        { schema: schemaRespostaConvite },
        async (req) => apresentarConvite(await conviteService.responder(req.params.id, req.body.aceito))
    );

    // Consultas para acompanhar o que os observadores fizeram.
    app.get<{ Params: { destinatarioId: string } }>('/mensagens/:destinatarioId', async (req) => {
        return canais.mensagens.listar(req.params.destinatarioId);
    });

    app.get('/auditoria', async () => canais.auditoria.listar());
}
