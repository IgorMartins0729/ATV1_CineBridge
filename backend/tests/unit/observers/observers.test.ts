import { describe, expect, it, vi } from 'vitest';
import { criarEvento, TipoEvento, type Evento } from '../../../src/application/eventos/EventoRecomendacao.js';
import { AtualizadorComposicaoEquipe } from '../../../src/application/observers/AtualizadorComposicaoEquipe.js';
import { AuditoriaRecomendacao } from '../../../src/application/observers/AuditoriaRecomendacao.js';
import { NotificadorEmail } from '../../../src/application/observers/NotificadorEmail.js';
import { NotificadorInterno } from '../../../src/application/observers/NotificadorInterno.js';
import type { Observador } from '../../../src/application/observers/Observador.js';
import { FiltragemColaborativa } from '../../../src/application/strategies/FiltragemColaborativa.js';
import { Papel } from '../../../src/domain/enums/Papel.js';
import { IntegracaoMicrosservico } from '../../../src/infrastructure/integracoes/IntegracaoMicrosservico.js';
import { LoggerMemoria } from '../../../src/infrastructure/logging/LoggerMemoria.js';
import { CaixaMensagensMemoria } from '../../../src/infrastructure/notificacoes/CaixaMensagensMemoria.js';
import { EnviadorEmailSimulado } from '../../../src/infrastructure/notificacoes/EnviadorEmailSimulado.js';
import { RegistroAuditoriaLog } from '../../../src/infrastructure/notificacoes/RegistroAuditoriaLog.js';
import { criarProfissional, criarProjeto } from '../../fixtures/fabricas.js';
import { montarSistema } from '../../fixtures/sistema.js';

const produtor = { id: 'produtor-1', nome: 'Ana Produtora', email: 'ana@produtora.test' };
const profissional = { id: 'p1', nome: 'Bia', email: 'bia@x.test', papel: Papel.EDITOR };
const dadosConvite = { conviteId: 'c1', projetoId: 'proj', titulo: 'Filme', produtor, papel: Papel.EDITOR, profissional };

function montarObservadores() {
    const logger = new LoggerMemoria();
    const email = new EnviadorEmailSimulado(logger);
    const caixa = new CaixaMensagensMemoria();
    const auditoria = new RegistroAuditoriaLog(logger);
    return {
        logger,
        email,
        caixa,
        auditoria,
        notificadorEmail: new NotificadorEmail(email),
        notificadorInterno: new NotificadorInterno(caixa),
        auditoriaObservador: new AuditoriaRecomendacao(auditoria)
    };
}

describe('SistemaRecomendacao (sujeito)', () => {
    const diretor = criarProfissional({ id: 'dir', competencias: { direcao: 9 } });
    const editor = criarProfissional({ id: 'edi', especialidades: [Papel.EDITOR], competencias: { montagem: 9 } });
    const projeto = () => criarProjeto({ papeis: [[Papel.DIRETOR, 2], [Papel.EDITOR, 1]] });

    it('ao gerar uma recomendação notifica e-mail, mensagens internas e auditoria de forma independente', async () => {
        const { sistema, recomendacoes } = montarSistema({ profissionais: [diretor, editor] });
        const obs = montarObservadores();
        sistema.adicionarObservador(obs.notificadorEmail);
        sistema.adicionarObservador(obs.notificadorInterno);
        sistema.adicionarObservador(obs.auditoriaObservador);

        const p = projeto();
        const resultado = await sistema.executarRecomendacao(p);

        expect(resultado.parcial).toBe(false);
        expect(resultado.origemDados).toBe('repositorio');
        expect(resultado.sugestoes[0]?.getMembros()).toHaveLength(2);
        expect(await recomendacoes.listarPorProjeto(p.getId())).toHaveLength(1);

        expect(obs.email.getEnviados().map((m) => m.para).sort()).toEqual([diretor.getEmail(), editor.getEmail()].sort());
        expect(await obs.caixa.listar('dir')).toHaveLength(1);
        const registros = await obs.auditoria.listar();
        expect(registros).toHaveLength(1);
        expect(registros[0]?.tipo).toBe(TipoEvento.RECOMENDACAO_GERADA);
    });

    it('um observador que falha não impede os demais', async () => {
        const { sistema, logger } = montarSistema({ profissionais: [diretor, editor] });
        const obs = montarObservadores();
        const quebrado: Observador = {
            nome: 'Quebrado',
            atualizar: () => {
                throw new Error('SMTP fora do ar');
            }
        };
        sistema.adicionarObservador(quebrado);
        sistema.adicionarObservador(obs.auditoriaObservador);

        await expect(sistema.executarRecomendacao(projeto())).resolves.toBeDefined();
        expect(await obs.auditoria.listar()).toHaveLength(1);
        expect(logger.getEntradas().some((e) => e.nivel === 'error' && e.contexto['erro'] === 'SMTP fora do ar')).toBe(
            true
        );
    });

    it('adiciona e remove observadores sem alterar o sujeito', async () => {
        const { sistema } = montarSistema({ profissionais: [diretor, editor] });
        const atualizar = vi.fn();
        const observador: Observador = { nome: 'Contador', atualizar };

        sistema.adicionarObservador(observador);
        sistema.adicionarObservador(observador);
        expect(sistema.getObservadores()).toEqual(['Contador']);
        await sistema.executarRecomendacao(projeto());
        expect(atualizar).toHaveBeenCalledTimes(1);

        sistema.removerObservador(observador);
        expect(sistema.getObservadores()).toEqual([]);
        await sistema.executarRecomendacao(projeto());
        expect(atualizar).toHaveBeenCalledTimes(1);
    });

    it('resolve a estratégia: do projeto > definida no sistema > automática', () => {
        const { sistema } = montarSistema();
        expect(sistema.resolverEstrategia(criarProjeto({ orcamento: 30_000 })).nome).toBe('regras-orcamento');
        expect(sistema.resolverEstrategia(criarProjeto({ orcamento: 300_000 })).nome).toBe('similaridade-cosseno');

        sistema.definirEstrategia('filtragem-colaborativa');
        expect(sistema.getEstrategiaAtual()?.nome).toBe('filtragem-colaborativa');
        expect(sistema.resolverEstrategia(criarProjeto()).nome).toBe('filtragem-colaborativa');

        sistema.definirEstrategia(new FiltragemColaborativa({ topN: 1 }));
        expect(sistema.resolverEstrategia(criarProjeto({ estrategia: 'regras-orcamento' })).nome).toBe(
            'regras-orcamento'
        );
    });

    it('marca como parcial quando algum papel ficou sem candidatos', async () => {
        const { sistema } = montarSistema({ profissionais: [diretor] });
        const resultado = await sistema.executarRecomendacao(projeto());
        expect(resultado.parcial).toBe(true);
        expect(resultado.recomendacao.getPapeisSemCandidatos()).toEqual([Papel.EDITOR]);
    });

    it('não notifica de novo os membros mantidos fixos', async () => {
        const { sistema } = montarSistema({ profissionais: [diretor, editor] });
        const eventos: Evento[] = [];
        sistema.adicionarObservador({ nome: 'x', atualizar: (e) => void eventos.push(e) });
        await sistema.executarRecomendacao(projeto(), {
            papeis: [Papel.EDITOR],
            fixos: new Map([[Papel.DIRETOR, diretor]])
        });
        const evento = eventos[0];
        expect(evento?.tipo === TipoEvento.RECOMENDACAO_GERADA && evento.dados.recomendados.map((r) => r.id)).toEqual([
            'edi'
        ]);
    });
});

describe('Observadores concretos', () => {
    it('NotificadorEmail escreve para o profissional no convite e para o produtor na resposta', async () => {
        const obs = montarObservadores();
        await obs.notificadorEmail.atualizar(criarEvento(TipoEvento.CONVITE_ENVIADO, dadosConvite, 't'));
        await obs.notificadorEmail.atualizar(criarEvento(TipoEvento.CONVITE_ACEITO, dadosConvite, 't'));
        await obs.notificadorEmail.atualizar(criarEvento(TipoEvento.CONVITE_RECUSADO, dadosConvite, 't'));
        const enviados = obs.email.getEnviados();
        expect(enviados.map((m) => m.para)).toEqual(['bia@x.test', 'ana@produtora.test', 'ana@produtora.test']);
        expect(enviados[1]?.assunto).toBe('Bia aceitou o convite');
        expect(enviados[2]?.assunto).toBe('Bia recusou o convite');
    });

    it('notificadores avisam produtor e membros quando a equipe é formada e ignoram eventos sem destinatário', async () => {
        const obs = montarObservadores();
        const formada = criarEvento(
            TipoEvento.EQUIPE_FORMADA,
            {
                projetoId: 'proj',
                titulo: 'Filme',
                produtor,
                equipeId: 'e1',
                orcamento: 100,
                custoTotal: 90,
                dataFormacao: new Date().toISOString(),
                membros: [{ ...profissional, precoMedio: 90 }]
            },
            't'
        );
        const substituicao = criarEvento(
            TipoEvento.MEMBRO_SUBSTITUIDO,
            { projetoId: 'proj', papel: Papel.EDITOR, motivo: 'SUBSTITUICAO', anteriorId: null, novo: null },
            't'
        );
        for (const evento of [formada, substituicao]) {
            await obs.notificadorEmail.atualizar(evento);
            await obs.notificadorInterno.atualizar(evento);
        }
        expect(obs.email.getEnviados().map((m) => m.para)).toEqual(['ana@produtora.test', 'bia@x.test']);
        expect(await obs.caixa.listar('produtor-1')).toHaveLength(1);
        expect(await obs.caixa.listar('p1')).toHaveLength(1);
    });

    it('NotificadorInterno entrega convites e respostas na caixa certa', async () => {
        const obs = montarObservadores();
        await obs.notificadorInterno.atualizar(criarEvento(TipoEvento.CONVITE_ENVIADO, dadosConvite, 't'));
        await obs.notificadorInterno.atualizar(criarEvento(TipoEvento.CONVITE_ACEITO, dadosConvite, 't'));
        await obs.notificadorInterno.atualizar(criarEvento(TipoEvento.CONVITE_RECUSADO, dadosConvite, 't'));
        expect((await obs.caixa.listar('p1')).map((m) => m.titulo)).toEqual(['Novo convite']);
        expect((await obs.caixa.listar('produtor-1')).map((m) => m.titulo)).toEqual([
            'Convite aceito',
            'Convite recusado'
        ]);
    });

    it('AuditoriaRecomendacao registra qualquer evento como log estruturado', async () => {
        const obs = montarObservadores();
        await obs.auditoriaObservador.atualizar(criarEvento(TipoEvento.CONVITE_ACEITO, dadosConvite, 'ConviteService'));
        const [registro] = await obs.auditoria.listar();
        expect(registro).toMatchObject({ tipo: 'CONVITE_ACEITO', origem: 'ConviteService', dados: dadosConvite });
        expect(obs.logger.getEntradas().some((e) => e.mensagem === 'auditoria')).toBe(true);
    });

    it('AtualizadorComposicaoEquipe confirma presença no aceite e reage à recusa', async () => {
        const reacoes = { confirmarPresenca: vi.fn(async () => {}), tratarRecusa: vi.fn(async () => {}) };
        const atualizador = new AtualizadorComposicaoEquipe(reacoes);
        await atualizador.atualizar(criarEvento(TipoEvento.CONVITE_ACEITO, dadosConvite, 't'));
        await atualizador.atualizar(criarEvento(TipoEvento.CONVITE_RECUSADO, dadosConvite, 't'));
        await atualizador.atualizar(criarEvento(TipoEvento.CONVITE_ENVIADO, dadosConvite, 't'));
        expect(reacoes.confirmarPresenca).toHaveBeenCalledWith('proj', Papel.EDITOR, 'p1');
        expect(reacoes.tratarRecusa).toHaveBeenCalledWith('proj', Papel.EDITOR, 'p1');
    });

    it('IntegracaoMicrosservico só encaminha equipe formada', () => {
        const integracao = new IntegracaoMicrosservico('financeiro', new LoggerMemoria());
        integracao.atualizar(criarEvento(TipoEvento.CONVITE_ACEITO, dadosConvite, 't'));
        expect(integracao.getEnviados()).toHaveLength(0);
        integracao.atualizar(
            criarEvento(
                TipoEvento.EQUIPE_FORMADA,
                {
                    projetoId: 'proj',
                    titulo: 'F',
                    produtor,
                    equipeId: 'e',
                    orcamento: 1,
                    custoTotal: 1,
                    dataFormacao: '',
                    membros: []
                },
                't'
            )
        );
        expect(integracao.getEnviados()).toMatchObject([{ destino: 'financeiro', evento: 'EQUIPE_FORMADA' }]);
        expect(integracao.nome).toBe('Integracao:financeiro');
    });
});
