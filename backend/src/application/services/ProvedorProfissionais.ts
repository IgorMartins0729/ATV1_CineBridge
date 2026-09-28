import type { Profissional } from '../../domain/entities/Profissional.js';
import type { ILogger } from '../ports/ILogger.js';
import type { FiltroCandidatos, IProfissionalRepository } from '../ports/IProfissionalRepository.js';

export type OrigemDados = 'repositorio' | 'cache' | 'fallback' | 'indisponivel';

export interface ResultadoBusca {
    profissionais: Profissional[];
    /** true quando os dados não vieram do repositório principal. */
    parcial: boolean;
    origem: OrigemDados;
}

export interface ConfigResiliencia {
    /** Tempo máximo de espera pelo repositório principal. */
    timeoutMs: number;
    /** Falhas seguidas até "abrir o circuito" e parar de tentar por um tempo. */
    limiteFalhas: number;
    pausaCircuitoMs: number;
    /** Quantos resultados de busca guardar para usar quando o repositório cair. */
    tamanhoCache: number;
}

export const CONFIG_RESILIENCIA_PADRAO: ConfigResiliencia = {
    timeoutMs: 1_000,
    limiteFalhas: 3,
    pausaCircuitoMs: 30_000,
    tamanhoCache: 100
};

export interface DependenciasProvedor {
    repositorio: IProfissionalRepository;
    logger: ILogger;
    /** Fonte alternativa definida (ex.: snapshot local) usada quando não há cache. */
    fallback?: IProfissionalRepository;
    config?: Partial<ConfigResiliencia>;
    relogio?: () => number;
}

class TempoEsgotadoError extends Error {}

/**
 * Tolerância a falhas do repositório de profissionais:
 * timeout + circuit breaker simples + cache do último resultado + fallback definido.
 * Nunca lança erro: no pior caso devolve lista vazia marcada como parcial.
 */
export class ProvedorProfissionais {
    private readonly repositorio: IProfissionalRepository;
    private readonly fallback: IProfissionalRepository | null;
    private readonly logger: ILogger;
    private readonly config: ConfigResiliencia;
    private readonly relogio: () => number;
    private readonly cache = new Map<string, Profissional[]>();
    private falhasSeguidas = 0;
    private circuitoAbertoAte = 0;

    constructor(deps: DependenciasProvedor) {
        this.repositorio = deps.repositorio;
        this.fallback = deps.fallback ?? null;
        this.logger = deps.logger;
        this.config = { ...CONFIG_RESILIENCIA_PADRAO, ...deps.config };
        this.relogio = deps.relogio ?? Date.now;
    }

    public async buscar(filtro: FiltroCandidatos): Promise<ResultadoBusca> {
        const chave = this.chave(filtro);

        if (this.circuitoAberto()) {
            this.logger.warn('Repositório de profissionais em pausa (circuito aberto); usando fallback');
        } else {
            try {
                const profissionais = await this.comTimeout(this.repositorio.buscarCandidatos(filtro));
                this.falhasSeguidas = 0;
                this.guardarNoCache(chave, profissionais);
                return { profissionais, parcial: false, origem: 'repositorio' };
            } catch (erro) {
                this.registrarFalha(erro);
            }
        }
        return this.usarFallback(chave, filtro);
    }

    private async usarFallback(chave: string, filtro: FiltroCandidatos): Promise<ResultadoBusca> {
        const emCache = this.cache.get(chave);
        if (emCache) {
            return { profissionais: emCache, parcial: true, origem: 'cache' };
        }
        if (this.fallback) {
            try {
                const profissionais = await this.fallback.buscarCandidatos(filtro);
                return { profissionais, parcial: true, origem: 'fallback' };
            } catch (erro) {
                this.logger.error('Fallback de profissionais também falhou', { erro: mensagemDe(erro) });
            }
        }
        return { profissionais: [], parcial: true, origem: 'indisponivel' };
    }

    private circuitoAberto(): boolean {
        return this.relogio() < this.circuitoAbertoAte;
    }

    private registrarFalha(erro: unknown): void {
        this.falhasSeguidas++;
        const motivo = erro instanceof TempoEsgotadoError ? 'timeout' : 'erro';
        this.logger.warn('Falha ao consultar repositório de profissionais', {
            motivo,
            erro: mensagemDe(erro),
            falhasSeguidas: this.falhasSeguidas
        });
        if (this.falhasSeguidas >= this.config.limiteFalhas) {
            this.circuitoAbertoAte = this.relogio() + this.config.pausaCircuitoMs;
            this.falhasSeguidas = 0;
        }
    }

    private comTimeout<T>(promessa: Promise<T>): Promise<T> {
        let temporizador: NodeJS.Timeout | undefined;
        const limite = new Promise<never>((_, rejeitar) => {
            temporizador = setTimeout(
                () => rejeitar(new TempoEsgotadoError(`sem resposta em ${this.config.timeoutMs} ms`)),
                this.config.timeoutMs
            );
        });
        return Promise.race([promessa, limite]).finally(() => clearTimeout(temporizador));
    }

    private guardarNoCache(chave: string, profissionais: Profissional[]): void {
        this.cache.delete(chave);
        this.cache.set(chave, profissionais);
        if (this.cache.size > this.config.tamanhoCache) {
            const maisAntiga = this.cache.keys().next().value;
            if (maisAntiga !== undefined) this.cache.delete(maisAntiga);
        }
    }

    private chave(filtro: FiltroCandidatos): string {
        return JSON.stringify({
            papeis: [...filtro.papeis].sort(),
            data: filtro.disponivelEm?.toISOString() ?? null,
            preco: filtro.precoMaximo ?? null,
            excluir: [...(filtro.excluirIds ?? [])].sort()
        });
    }
}

function mensagemDe(erro: unknown): string {
    return erro instanceof Error ? erro.message : String(erro);
}
