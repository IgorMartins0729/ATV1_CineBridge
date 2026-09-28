import { OrquestradorPadrao } from '../../src/application/orquestrador/OrquestradorPadrao.js';
import { SistemaRecomendacao } from '../../src/application/observers/SistemaRecomendacao.js';
import type { IProfissionalRepository } from '../../src/application/ports/IProfissionalRepository.js';
import { ProvedorProfissionais } from '../../src/application/services/ProvedorProfissionais.js';
import { FiltragemColaborativa } from '../../src/application/strategies/FiltragemColaborativa.js';
import { RegistroEstrategias } from '../../src/application/strategies/RegistroEstrategias.js';
import { RegrasOrcamento } from '../../src/application/strategies/RegrasOrcamento.js';
import { SimilaridadeCosseno } from '../../src/application/strategies/SimilaridadeCosseno.js';
import type { Profissional } from '../../src/domain/entities/Profissional.js';
import { NodeEventBus } from '../../src/infrastructure/events/NodeEventBus.js';
import { LoggerMemoria } from '../../src/infrastructure/logging/LoggerMemoria.js';
import { ProfissionalRepositoryMemoria } from '../../src/infrastructure/repositories/memoria/ProfissionalRepositoryMemoria.js';
import { RecomendacaoRepositoryMemoria } from '../../src/infrastructure/repositories/memoria/RecomendacaoRepositoryMemoria.js';
import { HOJE } from './fabricas.js';

export function criarRegistroEstrategias(): RegistroEstrategias {
    return new RegistroEstrategias([new SimilaridadeCosseno(), new FiltragemColaborativa(), new RegrasOrcamento()], {
        padrao: 'similaridade-cosseno',
        limiteOrcamentoReduzido: 50_000,
        estrategiaOrcamentoReduzido: 'regras-orcamento'
    });
}

export interface OpcoesSistemaTeste {
    profissionais?: Profissional[];
    repositorio?: IProfissionalRepository;
}

/** Monta o SistemaRecomendacao com dependências em memória, como o container faz. */
export function montarSistema(opcoes: OpcoesSistemaTeste = {}) {
    const logger = new LoggerMemoria();
    const eventBus = new NodeEventBus(logger);
    const repositorio = opcoes.repositorio ?? new ProfissionalRepositoryMemoria(opcoes.profissionais ?? []);
    const recomendacoes = new RecomendacaoRepositoryMemoria();
    const sistema = new SistemaRecomendacao({
        orquestrador: new OrquestradorPadrao({ relogio: () => HOJE }),
        provedor: new ProvedorProfissionais({ repositorio, logger, config: { timeoutMs: 50 } }),
        estrategias: criarRegistroEstrategias(),
        eventBus,
        recomendacoes
    });
    return { sistema, eventBus, logger, recomendacoes, repositorio };
}
