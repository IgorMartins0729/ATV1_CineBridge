import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterEach, describe, expect, it } from 'vitest';
import type { FiltroCandidatos } from '../../src/application/ports/IProfissionalRepository.js';
import { criarContainer, type Container } from '../../src/config/container.js';
import type { Profissional } from '../../src/domain/entities/Profissional.js';
import { Papel } from '../../src/domain/enums/Papel.js';
import { gerarProfissionais } from '../../src/infrastructure/dados/geradorProfissionais.js';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { ProfissionalRepositoryMemoria } from '../../src/infrastructure/repositories/memoria/ProfissionalRepositoryMemoria.js';
import { HOJE } from '../fixtures/fabricas.js';

const PROFISSIONAIS = gerarProfissionais(600, { semente: 7, referencia: HOJE });

function corpoProjeto(extra: Record<string, unknown> = {}) {
    return {
        titulo: 'Vozes do Sertão',
        produtor: { id: 'prod-1', nome: 'Paula Lima', email: 'paula@produtora.com' },
        genero: 'drama',
        duracao: 95,
        orcamento: 180_000,
        prazo: '2027-06-30',
        tipoCaptacao: 'FICCAO',
        localizacao: { cidade: 'Recife', uf: 'PE' },
        papeisObrigatorios: [
            { papel: 'DIRETOR', peso: 3 },
            { papel: 'DIRETOR_FOTOGRAFIA', peso: 2 },
            { papel: 'EDITOR', peso: 1 }
        ],
        ...extra
    };
}

let app: FastifyInstance | null = null;

function iniciar(opcoes: Parameters<typeof criarContainer>[0] = {}): { app: FastifyInstance; container: Container } {
    const container = criarContainer({ profissionais: PROFISSIONAIS, relogio: () => HOJE, ...opcoes });
    app = buildApp(container);
    return { app, container };
}

afterEach(async () => {
    await app?.close();
    app = null;
});

async function criarProjeto(servidor: FastifyInstance, extra: Record<string, unknown> = {}) {
    const resposta = await servidor.inject({ method: 'POST', url: '/projetos/recomendacoes', payload: corpoProjeto(extra) });
    expect(resposta.statusCode).toBe(201);
    return resposta.json();
}

describe('API REST: recomendação de equipe', () => {
    it('POST /projetos/recomendacoes aceita um projeto, aplica a estratégia e retorna a equipe recomendada', async () => {
        const { app: servidor, container } = iniciar();
        const corpo = await criarProjeto(servidor);

        expect(corpo.projeto.id).toBeTruthy();
        expect(corpo.recomendacao.estrategia).toBe('similaridade-cosseno');
        expect(corpo.parcial).toBe(false);
        expect(corpo.origemDados).toBe('repositorio');
        expect(corpo.equipeRecomendada.membros.map((m: { papel: string }) => m.papel).sort()).toEqual(
            ['DIRETOR', 'DIRETOR_FOTOGRAFIA', 'EDITOR'].sort()
        );
        expect(corpo.equipeRecomendada.custoTotal).toBeLessThanOrEqual(180_000);
        expect(corpo.sugestoes.length).toBeGreaterThanOrEqual(1);
        expect(Object.keys(corpo.recomendacao.ranking)).toHaveLength(3);
        expect(corpo.projeto.equipe.status).toBe('EM_FORMACAO');

        // Notificações e auditoria foram emitidas.
        expect(container.canais.email.getEnviados().length).toBeGreaterThan(0);
        const auditoria = await servidor.inject({ method: 'GET', url: '/auditoria' });
        expect(auditoria.json()[0].tipo).toBe('RECOMENDACAO_GERADA');
        const membro = corpo.equipeRecomendada.membros[0].profissional.id;
        const mensagens = await servidor.inject({ method: 'GET', url: `/mensagens/${membro}` });
        expect(mensagens.json()).toHaveLength(1);
    });

    it('trocar a estratégia altera o resultado da recomendação', async () => {
        const { app: servidor } = iniciar();
        const porEstrategia = new Map<string, string>();
        for (const estrategia of ['similaridade-cosseno', 'filtragem-colaborativa', 'regras-orcamento']) {
            const corpo = await criarProjeto(servidor, { estrategia });
            expect(corpo.recomendacao.estrategia).toBe(estrategia);
            porEstrategia.set(
                estrategia,
                corpo.recomendacao.ranking.DIRETOR.map((c: { id: string }) => c.id).join(',')
            );
        }
        expect(new Set(porEstrategia.values()).size).toBe(3);
    });

    it('projeto com orçamento reduzido usa regras de orçamento automaticamente', async () => {
        const { app: servidor } = iniciar();
        const corpo = await criarProjeto(servidor, { orcamento: 40_000 });
        expect(corpo.recomendacao.estrategia).toBe('regras-orcamento');
    });

    it('valida a entrada com JSON Schema (400) e regras de domínio (422)', async () => {
        const { app: servidor } = iniciar();
        const invalido = await servidor.inject({
            method: 'POST',
            url: '/projetos/recomendacoes',
            payload: corpoProjeto({ orcamento: -1, tipoCaptacao: 'NOVELA' })
        });
        expect(invalido.statusCode).toBe(400);
        expect(invalido.json().erro).toBe('VALIDACAO');

        const semCampos = await servidor.inject({ method: 'POST', url: '/projetos/recomendacoes', payload: {} });
        expect(semCampos.statusCode).toBe(400);

        const estrategiaInvalida = await servidor.inject({
            method: 'POST',
            url: '/projetos/recomendacoes',
            payload: corpoProjeto({ estrategia: 'sorteio' })
        });
        expect(estrategiaInvalida.statusCode).toBe(400);
        expect(estrategiaInvalida.json().mensagem).toContain('Estratégia desconhecida');

        const prazoPassado = await servidor.inject({
            method: 'POST',
            url: '/projetos/recomendacoes',
            payload: corpoProjeto({ prazo: '2026-01-01' })
        });
        expect(prazoPassado.statusCode).toBe(422);
        expect(prazoPassado.json().problemas).toContain('a data de entrega precisa ser futura');

        const jsonQuebrado = await servidor.inject({
            method: 'POST',
            url: '/projetos/recomendacoes',
            headers: { 'content-type': 'application/json' },
            payload: '{"titulo":'
        });
        expect(jsonQuebrado.statusCode).toBe(400);
    });

    it('retorna 404 para recursos inexistentes', async () => {
        const { app: servidor } = iniciar();
        for (const url of ['/projetos/nao-existe', '/convites/nao-existe', '/projetos/nao-existe/relatorio']) {
            const resposta = await servidor.inject({ method: 'GET', url });
            expect(resposta.statusCode).toBe(404);
            expect(resposta.json().erro).toBe('NAO_ENCONTRADO');
        }
    });

    it('GET /health e GET /estrategias', async () => {
        const { app: servidor } = iniciar();
        expect((await servidor.inject({ method: 'GET', url: '/health' })).json()).toEqual({
            status: 'ok',
            profissionaisCadastrados: 600
        });
        const estrategias = (await servidor.inject({ method: 'GET', url: '/estrategias' })).json();
        expect(estrategias.padrao).toBe('similaridade-cosseno');
        expect(estrategias.disponiveis).toHaveLength(3);
    });
});

describe('API REST: fluxo do produtor e dos profissionais', () => {
    it('aceitar membros, profissionais aceitarem convites e a equipe ser formada', async () => {
        const { app: servidor, container } = iniciar();
        const { projeto } = await criarProjeto(servidor);

        const convites: Array<{ id: string }> = [];
        for (const papel of ['DIRETOR', 'DIRETOR_FOTOGRAFIA', 'EDITOR']) {
            const resposta = await servidor.inject({ method: 'POST', url: `/projetos/${projeto.id}/membros/${papel}/aceitar` });
            expect(resposta.statusCode).toBe(201);
            expect(resposta.json().status).toBe('PENDENTE');
            convites.push(resposta.json());
        }
        expect((await servidor.inject({ method: 'GET', url: `/projetos/${projeto.id}/convites` })).json()).toHaveLength(3);
        expect((await servidor.inject({ method: 'GET', url: `/convites/${convites[0]!.id}` })).json().status).toBe('PENDENTE');

        for (const convite of convites) {
            const resposta = await servidor.inject({
                method: 'POST',
                url: `/convites/${convite.id}/resposta`,
                payload: { aceito: true }
            });
            expect(resposta.json().status).toBe('ACEITO');
        }

        const final = (await servidor.inject({ method: 'GET', url: `/projetos/${projeto.id}` })).json();
        expect(final.equipe.status).toBe('FORMADA');
        expect(final.equipe.membros.every((m: { confirmado: boolean }) => m.confirmado)).toBe(true);
        expect(container.integracoes.financeiro.getEnviados()).toHaveLength(1);
        expect(container.integracoes.gerenciamentoProjetos.getEnviados()).toHaveLength(1);

        const relatorio = (await servidor.inject({ method: 'GET', url: `/projetos/${projeto.id}/relatorio` })).json();
        expect(relatorio.consistente).toBe(true);
        expect(relatorio.compatibilidade).toBeGreaterThan(0);
        expect(relatorio.relatorio).toContain('EQUIPE (FORMADA)');

        const depois = await servidor.inject({ method: 'POST', url: `/projetos/${projeto.id}/membros/EDITOR/rejeitar` });
        expect(depois.statusCode).toBe(409);
    });

    it('rejeitar e substituir mantêm os demais membros fixos', async () => {
        const { app: servidor } = iniciar();
        const { projeto, equipeRecomendada } = await criarProjeto(servidor);
        const diretorOriginal = equipeRecomendada.membros.find((m: { papel: string }) => m.papel === 'DIRETOR').profissional.id;
        const editorOriginal = equipeRecomendada.membros.find((m: { papel: string }) => m.papel === 'EDITOR').profissional.id;

        const rejeicao = (await servidor.inject({ method: 'POST', url: `/projetos/${projeto.id}/membros/EDITOR/rejeitar` })).json();
        expect(rejeicao.novoMembro.id).not.toBe(editorOriginal);
        expect(rejeicao.projeto.profissionaisRejeitados).toContain(editorOriginal);
        const diretorDepois = rejeicao.projeto.equipe.membros.find((m: { papel: string }) => m.papel === 'DIRETOR');
        expect(diretorDepois.profissional.id).toBe(diretorOriginal);

        const escolhido = rejeicao.alternativas.at(-1).id;
        const substituicao = await servidor.inject({
            method: 'POST',
            url: `/projetos/${projeto.id}/membros/EDITOR/substituir`,
            payload: { profissionalId: escolhido }
        });
        expect(substituicao.json().novoMembro.id).toBe(escolhido);

        const semEscolha = await servidor.inject({ method: 'POST', url: `/projetos/${projeto.id}/membros/EDITOR/substituir` });
        expect(semEscolha.statusCode).toBe(200);

        const papelInvalido = await servidor.inject({ method: 'POST', url: `/projetos/${projeto.id}/membros/ATOR/aceitar` });
        expect(papelInvalido.statusCode).toBe(400);
    });

    it('recusa de convite gera nova recomendação para o papel', async () => {
        const { app: servidor } = iniciar();
        const { projeto, equipeRecomendada } = await criarProjeto(servidor);
        const editorOriginal = equipeRecomendada.membros.find((m: { papel: string }) => m.papel === 'EDITOR').profissional.id;
        const convite = (await servidor.inject({ method: 'POST', url: `/projetos/${projeto.id}/membros/EDITOR/aceitar` })).json();

        const resposta = await servidor.inject({ method: 'POST', url: `/convites/${convite.id}/resposta`, payload: { aceito: false } });
        expect(resposta.json().status).toBe('RECUSADO');
        const atualizado = (await servidor.inject({ method: 'GET', url: `/projetos/${projeto.id}` })).json();
        const editor = atualizado.equipe.membros.find((m: { papel: string }) => m.papel === Papel.EDITOR);
        expect(editor.profissional.id).not.toBe(editorOriginal);

        const repetida = await servidor.inject({ method: 'POST', url: `/convites/${convite.id}/resposta`, payload: { aceito: true } });
        expect(repetida.statusCode).toBe(409);
    });

    it('PATCH /restricoes reavalia a equipe só em mudanças significativas; POST /recomendacoes refaz com outra estratégia', async () => {
        const { app: servidor } = iniciar();
        const { projeto } = await criarProjeto(servidor);

        const pequena = await servidor.inject({ method: 'PATCH', url: `/projetos/${projeto.id}/restricoes`, payload: { orcamento: 185_000 } });
        expect(pequena.json().reavaliado).toBe(false);

        const grande = await servidor.inject({
            method: 'PATCH',
            url: `/projetos/${projeto.id}/restricoes`,
            payload: { orcamento: 90_000, prazo: '2027-08-30' }
        });
        expect(grande.json().reavaliado).toBe(true);
        expect(grande.json().equipeRecomendada).toBeTruthy();

        const vazio = await servidor.inject({ method: 'PATCH', url: `/projetos/${projeto.id}/restricoes`, payload: {} });
        expect(vazio.statusCode).toBe(400);

        const nova = await servidor.inject({
            method: 'POST',
            url: `/projetos/${projeto.id}/recomendacoes`,
            payload: { estrategia: 'filtragem-colaborativa' }
        });
        expect(nova.json().recomendacao.estrategia).toBe('filtragem-colaborativa');
        const semCorpo = await servidor.inject({ method: 'POST', url: `/projetos/${projeto.id}/recomendacoes` });
        expect(semCorpo.statusCode).toBe(200);
    });
});

describe('API REST: tolerância a falhas', () => {
    class RepositorioQueCai extends ProfissionalRepositoryMemoria {
        falhar = false;
        override async buscarCandidatos(filtro: FiltroCandidatos): Promise<Profissional[]> {
            if (this.falhar) throw new Error('banco fora do ar');
            return super.buscarCandidatos(filtro);
        }
    }

    it('com o repositório fora do ar a API responde com recomendação parcial em vez de erro', async () => {
        const repositorio = new RepositorioQueCai(PROFISSIONAIS);
        const { app: servidor } = iniciar({ repositorios: { profissionais: repositorio } });
        await criarProjeto(servidor);

        repositorio.falhar = true;
        const comCache = await criarProjeto(servidor);
        expect(comCache.parcial).toBe(true);
        expect(comCache.origemDados).toBe('cache');
        expect(comCache.equipeRecomendada).toBeTruthy();

        const semCache = await criarProjeto(servidor, { tipoCaptacao: 'ANIMACAO', prazo: '2027-05-30' });
        expect(semCache.parcial).toBe(true);
        expect(semCache.origemDados).toBe('indisponivel');
        expect(semCache.equipeRecomendada).toBeNull();
        expect(semCache.recomendacao.papeisSemCandidatos).toHaveLength(3);
    });

    it('erro inesperado vira 500 sem vazar detalhes; logger pino do Fastify é aceito', async () => {
        const container = criarContainer({ profissionais: PROFISSIONAIS, relogio: () => HOJE });
        container.projetoService.buscar = async () => {
            throw new Error('falha interna com detalhe sensível');
        };
        app = buildApp(container, { logger: pino({ level: 'silent' }) });
        const resposta = await app.inject({ method: 'GET', url: '/projetos/x' });
        expect(resposta.statusCode).toBe(500);
        expect(resposta.json()).toEqual({ erro: 'ERRO_INTERNO', mensagem: 'Erro inesperado no servidor' });
    });
});
