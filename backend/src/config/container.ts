import { AtualizadorComposicaoEquipe } from '../application/observers/AtualizadorComposicaoEquipe.js';
import { AuditoriaRecomendacao } from '../application/observers/AuditoriaRecomendacao.js';
import { NotificadorEmail } from '../application/observers/NotificadorEmail.js';
import { NotificadorInterno } from '../application/observers/NotificadorInterno.js';
import { SistemaRecomendacao } from '../application/observers/SistemaRecomendacao.js';
import { OrquestradorPadrao } from '../application/orquestrador/OrquestradorPadrao.js';
import type { IConviteRepository } from '../application/ports/IConviteRepository.js';
import type { IEventBus } from '../application/ports/IEventBus.js';
import type { ILogger } from '../application/ports/ILogger.js';
import type { IProfissionalRepository } from '../application/ports/IProfissionalRepository.js';
import type { IProjetoRepository } from '../application/ports/IProjetoRepository.js';
import type { IRecomendacaoRepository } from '../application/ports/IRecomendacaoRepository.js';
import { ConviteService } from '../application/services/ConviteService.js';
import { GestaoEquipeService } from '../application/services/GestaoEquipeService.js';
import { ProjetoService } from '../application/services/ProjetoService.js';
import { ProvedorProfissionais } from '../application/services/ProvedorProfissionais.js';
import { FiltragemColaborativa } from '../application/strategies/FiltragemColaborativa.js';
import { RegistroEstrategias } from '../application/strategies/RegistroEstrategias.js';
import { RegrasOrcamento } from '../application/strategies/RegrasOrcamento.js';
import { SimilaridadeCosseno } from '../application/strategies/SimilaridadeCosseno.js';
import type { Profissional } from '../domain/entities/Profissional.js';
import { NodeEventBus } from '../infrastructure/events/NodeEventBus.js';
import { IntegracaoMicrosservico } from '../infrastructure/integracoes/IntegracaoMicrosservico.js';
import { LoggerMemoria } from '../infrastructure/logging/LoggerMemoria.js';
import { CaixaMensagensMemoria } from '../infrastructure/notificacoes/CaixaMensagensMemoria.js';
import { EnviadorEmailSimulado } from '../infrastructure/notificacoes/EnviadorEmailSimulado.js';
import { RegistroAuditoriaLog } from '../infrastructure/notificacoes/RegistroAuditoriaLog.js';
import { ConviteRepositoryMemoria } from '../infrastructure/repositories/memoria/ConviteRepositoryMemoria.js';
import { ProfissionalRepositoryMemoria } from '../infrastructure/repositories/memoria/ProfissionalRepositoryMemoria.js';
import { ProjetoRepositoryMemoria } from '../infrastructure/repositories/memoria/ProjetoRepositoryMemoria.js';
import { RecomendacaoRepositoryMemoria } from '../infrastructure/repositories/memoria/RecomendacaoRepositoryMemoria.js';
import { PARAMETROS_PADRAO, type ParametrosCineBridge } from './parametros.js';

export interface Repositorios {
    profissionais: IProfissionalRepository;
    projetos: IProjetoRepository;
    convites: IConviteRepository;
    recomendacoes: IRecomendacaoRepository;
}

export interface OpcoesContainer {
    parametros?: ParametrosCineBridge;
    logger?: ILogger;
    /** Troca qualquer repositório (ex.: Prisma em produção, repositório que falha nos testes). */
    repositorios?: Partial<Repositorios>;
    /** Profissionais iniciais do repositório em memória. */
    profissionais?: Profissional[];
    /** Fonte alternativa usada pelo fallback quando o repositório principal cai. */
    fallbackProfissionais?: IProfissionalRepository;
    relogio?: () => Date;
}

/**
 * Composition root: o único lugar que conhece as classes concretas.
 * Todo o resto recebe as dependências pelo construtor (injeção de dependências explícita).
 */
export function criarContainer(opcoes: OpcoesContainer = {}) {
    const parametros = opcoes.parametros ?? PARAMETROS_PADRAO;
    const logger = opcoes.logger ?? new LoggerMemoria();
    const eventBus: IEventBus = new NodeEventBus(logger);

    const repositorios: Repositorios = {
        profissionais: opcoes.repositorios?.profissionais ?? new ProfissionalRepositoryMemoria(opcoes.profissionais ?? []),
        projetos: opcoes.repositorios?.projetos ?? new ProjetoRepositoryMemoria(),
        convites: opcoes.repositorios?.convites ?? new ConviteRepositoryMemoria(),
        recomendacoes: opcoes.repositorios?.recomendacoes ?? new RecomendacaoRepositoryMemoria()
    };

    const estrategias = new RegistroEstrategias(
        [
            new SimilaridadeCosseno(parametros.estrategias.cosseno),
            new FiltragemColaborativa(parametros.estrategias.colaborativa),
            new RegrasOrcamento(parametros.estrategias.orcamento)
        ],
        parametros.estrategias.selecao
    );

    const provedor = new ProvedorProfissionais({
        repositorio: repositorios.profissionais,
        logger,
        config: parametros.resiliencia,
        ...(opcoes.fallbackProfissionais ? { fallback: opcoes.fallbackProfissionais } : {})
    });

    const sistema = new SistemaRecomendacao({
        orquestrador: new OrquestradorPadrao({
            quantidadeSugestoes: parametros.orquestrador.quantidadeSugestoes,
            ...(opcoes.relogio ? { relogio: opcoes.relogio } : {})
        }),
        provedor,
        estrategias,
        eventBus,
        recomendacoes: repositorios.recomendacoes
    });

    const projetoService = new ProjetoService({ projetos: repositorios.projetos, estrategias });
    const gestaoEquipe = new GestaoEquipeService({
        projetos: repositorios.projetos,
        convites: repositorios.convites,
        sistema,
        config: parametros.reavaliacao
    });
    const conviteService = new ConviteService({
        convites: repositorios.convites,
        projetos: repositorios.projetos,
        sistema
    });

    const canais = {
        email: new EnviadorEmailSimulado(logger),
        mensagens: new CaixaMensagensMemoria(),
        auditoria: new RegistroAuditoriaLog(logger)
    };
    const integracoes = {
        gerenciamentoProjetos: new IntegracaoMicrosservico('gerenciamento-projetos', logger),
        financeiro: new IntegracaoMicrosservico('processamento-financeiro', logger)
    };
    const observadores = [
        new NotificadorEmail(canais.email),
        new NotificadorInterno(canais.mensagens),
        new AuditoriaRecomendacao(canais.auditoria),
        new AtualizadorComposicaoEquipe(gestaoEquipe),
        integracoes.gerenciamentoProjetos,
        integracoes.financeiro
    ];
    for (const observador of observadores) {
        sistema.adicionarObservador(observador);
    }

    return {
        parametros,
        logger,
        eventBus,
        repositorios,
        estrategias,
        provedor,
        sistema,
        projetoService,
        gestaoEquipe,
        conviteService,
        canais,
        integracoes
    };
}

export type Container = ReturnType<typeof criarContainer>;
