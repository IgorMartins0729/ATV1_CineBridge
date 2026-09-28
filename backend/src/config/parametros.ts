import type { ConfigReavaliacao } from '../application/services/GestaoEquipeService.js';
import type { ConfigResiliencia } from '../application/services/ProvedorProfissionais.js';
import type { ConfigFiltragemColaborativa } from '../application/strategies/FiltragemColaborativa.js';
import type { ConfigSelecaoEstrategia } from '../application/strategies/RegistroEstrategias.js';
import type { ConfigRegrasOrcamento } from '../application/strategies/RegrasOrcamento.js';
import type { ConfigSimilaridadeCosseno } from '../application/strategies/SimilaridadeCosseno.js';

/** Todos os parâmetros ajustáveis do algoritmo e do serviço, em um só lugar. */
export interface ParametrosCineBridge {
    estrategias: {
        selecao: ConfigSelecaoEstrategia;
        cosseno: Partial<ConfigSimilaridadeCosseno>;
        colaborativa: Partial<ConfigFiltragemColaborativa>;
        orcamento: Partial<ConfigRegrasOrcamento>;
    };
    orquestrador: { quantidadeSugestoes: number };
    resiliencia: Partial<ConfigResiliencia>;
    reavaliacao: ConfigReavaliacao;
}

export const PARAMETROS_PADRAO: ParametrosCineBridge = {
    estrategias: {
        selecao: {
            padrao: 'similaridade-cosseno',
            limiteOrcamentoReduzido: 50_000,
            estrategiaOrcamentoReduzido: 'regras-orcamento'
        },
        cosseno: {},
        colaborativa: {},
        orcamento: {}
    },
    orquestrador: { quantidadeSugestoes: 3 },
    resiliencia: { timeoutMs: 1_000 },
    reavaliacao: { limiarOrcamento: 0.2, limiarPrazoDias: 15 }
};

type Parcial<T> = { [K in keyof T]?: T[K] extends object ? Parcial<T[K]> : T[K] };

function mesclar<T>(base: T, extra: Parcial<T> | undefined): T {
    if (extra === undefined) return base;
    const resultado: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [chave, valor] of Object.entries(extra as Record<string, unknown>)) {
        const atual = resultado[chave];
        resultado[chave] =
            valor && typeof valor === 'object' && !Array.isArray(valor) && atual && typeof atual === 'object'
                ? mesclar(atual, valor as Parcial<typeof atual>)
                : valor;
    }
    return resultado as T;
}

function numero(valor: string | undefined): number | undefined {
    if (valor === undefined || valor.trim() === '') return undefined;
    const convertido = Number(valor);
    if (!Number.isFinite(convertido)) {
        throw new Error(`Valor numérico inválido na configuração: "${valor}"`);
    }
    return convertido;
}

/**
 * Parâmetros padrão + variáveis de ambiente:
 * - ESTRATEGIA_PADRAO, LIMITE_ORCAMENTO_REDUZIDO, QUANTIDADE_SUGESTOES, TIMEOUT_REPOSITORIO_MS
 * - PARAMETROS_JSON: JSON com qualquer parte da estrutura (ex.: pesos das estratégias)
 */
export function carregarParametros(env: NodeJS.ProcessEnv = process.env): ParametrosCineBridge {
    const viaEnv: Parcial<ParametrosCineBridge> = {
        estrategias: {
            selecao: {
                ...(env['ESTRATEGIA_PADRAO'] ? { padrao: env['ESTRATEGIA_PADRAO'] } : {}),
                ...(numero(env['LIMITE_ORCAMENTO_REDUZIDO']) !== undefined
                    ? { limiteOrcamentoReduzido: numero(env['LIMITE_ORCAMENTO_REDUZIDO']) as number }
                    : {})
            }
        },
        orquestrador: {
            ...(numero(env['QUANTIDADE_SUGESTOES']) !== undefined
                ? { quantidadeSugestoes: numero(env['QUANTIDADE_SUGESTOES']) as number }
                : {})
        },
        resiliencia: {
            ...(numero(env['TIMEOUT_REPOSITORIO_MS']) !== undefined
                ? { timeoutMs: numero(env['TIMEOUT_REPOSITORIO_MS']) as number }
                : {})
        }
    };
    const json = env['PARAMETROS_JSON'] ? (JSON.parse(env['PARAMETROS_JSON']) as Parcial<ParametrosCineBridge>) : undefined;
    return mesclar(mesclar(PARAMETROS_PADRAO, viaEnv), json);
}
