import { describe, expect, it } from 'vitest';
import type { FiltroCandidatos, IProfissionalRepository } from '../../../src/application/ports/IProfissionalRepository.js';
import { ProvedorProfissionais } from '../../../src/application/services/ProvedorProfissionais.js';
import type { Profissional } from '../../../src/domain/entities/Profissional.js';
import { Papel } from '../../../src/domain/enums/Papel.js';
import { LoggerMemoria } from '../../../src/infrastructure/logging/LoggerMemoria.js';
import { ProfissionalRepositoryMemoria } from '../../../src/infrastructure/repositories/memoria/ProfissionalRepositoryMemoria.js';
import { criarProfissional } from '../../fixtures/fabricas.js';

/** Repositório controlável: pode responder, falhar ou demorar. */
class RepositorioInstavel extends ProfissionalRepositoryMemoria {
    modo: 'ok' | 'erro' | 'lento' = 'ok';
    chamadas = 0;

    override async buscarCandidatos(filtro: FiltroCandidatos): Promise<Profissional[]> {
        this.chamadas++;
        if (this.modo === 'erro') throw new Error('conexão recusada');
        if (this.modo === 'lento') await new Promise((resolve) => setTimeout(resolve, 200));
        return super.buscarCandidatos(filtro);
    }
}

const filtro: FiltroCandidatos = { papeis: [Papel.DIRETOR] };
const diretor = criarProfissional({ id: 'd1' });

function montar(opcoes: { fallback?: IProfissionalRepository; limiteFalhas?: number } = {}) {
    const repositorio = new RepositorioInstavel([diretor]);
    const logger = new LoggerMemoria();
    let agora = 0;
    const provedor = new ProvedorProfissionais({
        repositorio,
        logger,
        ...(opcoes.fallback ? { fallback: opcoes.fallback } : {}),
        config: { timeoutMs: 30, limiteFalhas: opcoes.limiteFalhas ?? 3, pausaCircuitoMs: 1_000, tamanhoCache: 2 },
        relogio: () => agora
    });
    return { provedor, repositorio, logger, avancar: (ms: number) => (agora += ms) };
}

describe('ProvedorProfissionais: tolerância a falhas', () => {
    it('com o repositório saudável devolve dados completos', async () => {
        const { provedor } = montar();
        expect(await provedor.buscar(filtro)).toEqual({ profissionais: [diretor], parcial: false, origem: 'repositorio' });
    });

    it('se o repositório cair, usa o último resultado em cache (recomendação parcial)', async () => {
        const { provedor, repositorio, logger } = montar();
        await provedor.buscar(filtro);
        repositorio.modo = 'erro';
        expect(await provedor.buscar(filtro)).toEqual({ profissionais: [diretor], parcial: true, origem: 'cache' });
        expect(logger.getEntradas().some((e) => e.nivel === 'warn' && e.contexto['motivo'] === 'erro')).toBe(true);
    });

    it('timeout: repositório lento conta como falha', async () => {
        const { provedor, repositorio, logger } = montar();
        repositorio.modo = 'lento';
        const resultado = await provedor.buscar(filtro);
        expect(resultado).toEqual({ profissionais: [], parcial: true, origem: 'indisponivel' });
        expect(logger.getEntradas().some((e) => e.contexto['motivo'] === 'timeout')).toBe(true);
    });

    it('sem cache, usa o fallback definido; se o fallback também falhar, devolve vazio', async () => {
        const reserva = new ProfissionalRepositoryMemoria([criarProfissional({ id: 'reserva' })]);
        const comReserva = montar({ fallback: reserva });
        comReserva.repositorio.modo = 'erro';
        const resultado = await comReserva.provedor.buscar(filtro);
        expect(resultado.origem).toBe('fallback');
        expect(resultado.profissionais.map((p) => p.getId())).toEqual(['reserva']);

        const reservaQuebrada = new RepositorioInstavel();
        reservaQuebrada.modo = 'erro';
        const semSaida = montar({ fallback: reservaQuebrada });
        semSaida.repositorio.modo = 'erro';
        expect((await semSaida.provedor.buscar(filtro)).origem).toBe('indisponivel');
        expect(semSaida.logger.getEntradas().some((e) => e.nivel === 'error')).toBe(true);
    });

    it('circuit breaker: após N falhas seguidas para de chamar o repositório por um tempo', async () => {
        const { provedor, repositorio, avancar } = montar({ limiteFalhas: 2 });
        repositorio.modo = 'erro';
        await provedor.buscar(filtro);
        await provedor.buscar(filtro);
        expect(repositorio.chamadas).toBe(2);

        await provedor.buscar(filtro);
        expect(repositorio.chamadas).toBe(2);

        avancar(1_001);
        repositorio.modo = 'ok';
        expect((await provedor.buscar(filtro)).origem).toBe('repositorio');
        expect(repositorio.chamadas).toBe(3);
    });

    it('o cache guarda só os resultados mais recentes', async () => {
        const { provedor, repositorio } = montar();
        await provedor.buscar({ papeis: [Papel.DIRETOR] });
        await provedor.buscar({ papeis: [Papel.EDITOR] });
        await provedor.buscar({ papeis: [Papel.SONOPLASTA], disponivelEm: new Date('2027-01-01'), precoMaximo: 5 });
        repositorio.modo = 'erro';
        expect((await provedor.buscar({ papeis: [Papel.DIRETOR] })).origem).toBe('indisponivel');
        expect((await provedor.buscar({ papeis: [Papel.EDITOR] })).origem).toBe('cache');
    });

    it('usa a configuração padrão quando nada é informado', async () => {
        const provedor = new ProvedorProfissionais({
            repositorio: new ProfissionalRepositoryMemoria([diretor]),
            logger: new LoggerMemoria()
        });
        expect((await provedor.buscar(filtro)).parcial).toBe(false);
    });
});
