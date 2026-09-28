import type { FastifyInstance } from 'fastify';
import { CalculadorCompatibilidade } from '../../../application/visitors/CalculadorCompatibilidade.js';
import { GeradorRelatorio } from '../../../application/visitors/GeradorRelatorio.js';
import { ValidadorConsistencia } from '../../../application/visitors/ValidadorConsistencia.js';
import type { Papel } from '../../../domain/enums/Papel.js';
import type { Container } from '../../../config/container.js';
import {
    apresentarConvite,
    apresentarProjeto,
    apresentarResultadoRecomendacao,
    apresentarSubstituicao
} from '../apresentadores.js';
import {
    schemaMembro,
    schemaNovaRecomendacao,
    schemaNovoProjeto,
    schemaProjetoPorId,
    schemaRestricoes,
    schemaSubstituicao,
    type CorpoNovoProjeto
} from '../schemas.js';

interface ParamsProjeto {
    id: string;
}

interface ParamsMembro extends ParamsProjeto {
    papel: Papel;
}

/** Controllers finos: validam a entrada (schema), chamam o caso de uso e formatam a saída. */
export function registrarRotasProjetos(app: FastifyInstance, container: Container): void {
    const { projetoService, gestaoEquipe } = container;

    // Endpoint principal: recebe um projeto, aplica a estratégia configurada e retorna a equipe recomendada.
    app.post<{ Body: CorpoNovoProjeto }>('/projetos/recomendacoes', { schema: schemaNovoProjeto }, async (req, res) => {
        const corpo = req.body;
        const projeto = await projetoService.criar({ ...corpo, prazo: new Date(corpo.prazo) });
        const resultado = await gestaoEquipe.recomendarEquipe(projeto.getId());
        return res.status(201).send(apresentarResultadoRecomendacao(await gestaoEquipe.buscarProjeto(projeto.getId()), resultado));
    });

    app.get<{ Params: ParamsProjeto }>('/projetos/:id', { schema: schemaProjetoPorId }, async (req) => {
        return apresentarProjeto(await projetoService.buscar(req.params.id));
    });

    app.post<{ Params: ParamsProjeto; Body: { estrategia?: string } | null }>(
        '/projetos/:id/recomendacoes',
        { schema: schemaNovaRecomendacao },
        async (req) => {
            const resultado = await gestaoEquipe.recomendarEquipe(req.params.id, req.body?.estrategia ?? null);
            return apresentarResultadoRecomendacao(await gestaoEquipe.buscarProjeto(req.params.id), resultado);
        }
    );

    app.post<{ Params: ParamsMembro }>('/projetos/:id/membros/:papel/aceitar', { schema: schemaMembro }, async (req, res) => {
        const convite = await gestaoEquipe.aceitarMembro(req.params.id, req.params.papel);
        return res.status(201).send(apresentarConvite(convite));
    });

    app.post<{ Params: ParamsMembro }>('/projetos/:id/membros/:papel/rejeitar', { schema: schemaMembro }, async (req) => {
        return apresentarSubstituicao(await gestaoEquipe.rejeitarMembro(req.params.id, req.params.papel));
    });

    app.post<{ Params: ParamsMembro; Body: { profissionalId?: string } | null }>(
        '/projetos/:id/membros/:papel/substituir',
        { schema: schemaSubstituicao },
        async (req) => {
            const resultado = await gestaoEquipe.substituirMembro(
                req.params.id,
                req.params.papel,
                ...(req.body?.profissionalId ? [req.body.profissionalId] : [])
            );
            return apresentarSubstituicao(resultado);
        }
    );

    app.patch<{ Params: ParamsProjeto; Body: { orcamento?: number; prazo?: string; forcarReavaliacao?: boolean } }>(
        '/projetos/:id/restricoes',
        { schema: schemaRestricoes },
        async (req) => {
            const { orcamento, prazo, forcarReavaliacao } = req.body;
            const alteracao = await gestaoEquipe.atualizarRestricoes(req.params.id, {
                orcamento,
                prazo: prazo === undefined ? undefined : new Date(prazo),
                forcarReavaliacao
            });
            return {
                reavaliado: alteracao.reavaliado,
                ...(alteracao.resultado
                    ? apresentarResultadoRecomendacao(alteracao.projeto, alteracao.resultado)
                    : { projeto: apresentarProjeto(alteracao.projeto) })
            };
        }
    );

    app.get<{ Params: ParamsProjeto }>('/projetos/:id/convites', { schema: schemaProjetoPorId }, async (req) => {
        return (await gestaoEquipe.listarConvites(req.params.id)).map(apresentarConvite);
    });

    // Os três visitantes percorrem o mesmo projeto e produzem resultados diferentes.
    app.get<{ Params: ParamsProjeto }>('/projetos/:id/relatorio', { schema: schemaProjetoPorId }, async (req) => {
        const projeto = await projetoService.buscar(req.params.id);
        const validador = new ValidadorConsistencia();
        const consistente = projeto.aceitar(validador);
        return {
            consistente,
            problemas: validador.getProblemas(),
            compatibilidade: projeto.aceitar(new CalculadorCompatibilidade()),
            relatorio: projeto.aceitar(new GeradorRelatorio())
        };
    });
}
