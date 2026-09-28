import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { criarContainer } from '../../../src/config/container.js';
import { carregarParametros, PARAMETROS_PADRAO } from '../../../src/config/parametros.js';
import { Papel } from '../../../src/domain/enums/Papel.js';
import { PinoLogger } from '../../../src/infrastructure/logging/PinoLogger.js';
import { criarProfissional, criarProjeto, HOJE } from '../../fixtures/fabricas.js';

describe('Parâmetros do algoritmo', () => {
    it('sem variáveis de ambiente usa os valores padrão', () => {
        expect(carregarParametros({})).toEqual(PARAMETROS_PADRAO);
    });

    it('lê variáveis de ambiente e PARAMETROS_JSON, mesclando com o padrão', () => {
        const parametros = carregarParametros({
            ESTRATEGIA_PADRAO: 'filtragem-colaborativa',
            LIMITE_ORCAMENTO_REDUZIDO: '80000',
            QUANTIDADE_SUGESTOES: '5',
            TIMEOUT_REPOSITORIO_MS: '250',
            PARAMETROS_JSON: JSON.stringify({ estrategias: { cosseno: { pesoMagnitude: 0.5, topN: 2 } } })
        });
        expect(parametros.estrategias.selecao).toEqual({
            padrao: 'filtragem-colaborativa',
            limiteOrcamentoReduzido: 80_000,
            estrategiaOrcamentoReduzido: 'regras-orcamento'
        });
        expect(parametros.orquestrador.quantidadeSugestoes).toBe(5);
        expect(parametros.resiliencia.timeoutMs).toBe(250);
        expect(parametros.estrategias.cosseno).toEqual({ pesoMagnitude: 0.5, topN: 2 });
        expect(parametros.reavaliacao).toEqual(PARAMETROS_PADRAO.reavaliacao);
    });

    it('recusa número inválido e ignora valores vazios', () => {
        expect(() => carregarParametros({ QUANTIDADE_SUGESTOES: 'muitas' })).toThrow(/Valor numérico inválido/);
        expect(carregarParametros({ TIMEOUT_REPOSITORIO_MS: ' ' }).resiliencia.timeoutMs).toBe(1_000);
    });

    it('os parâmetros mudam o comportamento do sistema montado pelo container', async () => {
        const parametros = carregarParametros({
            PARAMETROS_JSON: JSON.stringify({ estrategias: { cosseno: { topN: 1 } }, orquestrador: { quantidadeSugestoes: 1 } })
        });
        const profissionais = [1, 2, 3].map((i) => criarProfissional({ id: `d${i}`, competencias: { direcao: i } }));
        const container = criarContainer({ parametros, profissionais, relogio: () => HOJE });
        const projeto = criarProjeto({ papeis: [[Papel.DIRETOR, 1]], orcamento: 500_000 });
        const resultado = await container.sistema.executarRecomendacao(projeto);
        expect(resultado.recomendacao.getCandidatos(Papel.DIRETOR)).toHaveLength(1);
        expect(resultado.sugestoes).toHaveLength(1);
    });
});

describe('PinoLogger', () => {
    it('escreve logs estruturados em JSON', () => {
        const linhas: string[] = [];
        const destino = new Writable({
            write(parte, _codificacao, pronto) {
                linhas.push(parte.toString());
                pronto();
            }
        });
        const logger = new PinoLogger(pino({ level: 'info' }, destino));
        logger.info('recomendacao gerada', { projetoId: 'p1' });
        logger.warn('repositorio lento');
        logger.error('falhou', { erro: 'x' });

        const registros = linhas.map((l) => JSON.parse(l) as Record<string, unknown>);
        expect(registros.map((r) => r['msg'])).toEqual(['recomendacao gerada', 'repositorio lento', 'falhou']);
        expect(registros[0]?.['projetoId']).toBe('p1');
        expect(registros.map((r) => r['level'])).toEqual([30, 40, 50]);
    });
});
