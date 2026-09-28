import cluster from 'node:cluster';
import { pino } from 'pino';
import { carregarParametros } from './config/parametros.js';
import { criarContainer, type OpcoesContainer } from './config/container.js';
import { gerarProfissionais } from './infrastructure/dados/geradorProfissionais.js';
import { buildApp } from './infrastructure/http/app.js';
import { PinoLogger } from './infrastructure/logging/PinoLogger.js';

/**
 * Variáveis de ambiente:
 * - PORT (3000), HOST (0.0.0.0), LOG_LEVEL (info)
 * - REPOSITORIO: "memoria" (padrão) ou "prisma" (usa DATABASE_URL)
 * - PROFISSIONAIS_MEMORIA: quantos profissionais gerar no modo memória (10000)
 * - WORKERS: quantos processos atendem em paralelo (1). Use com REPOSITORIO=prisma,
 *   pois no modo memória cada processo teria os próprios projetos.
 * - demais parâmetros do algoritmo: ver src/config/parametros.ts
 */
async function iniciar(): Promise<void> {
    const pinoLogger = pino({ level: process.env['LOG_LEVEL'] ?? 'info' });
    const logger = new PinoLogger(pinoLogger);
    const opcoes: OpcoesContainer = { parametros: carregarParametros(), logger };

    let encerrarBanco: () => Promise<void> = async () => {};
    if (process.env['REPOSITORIO'] === 'prisma') {
        const { criarRepositoriosPrisma } = await import('./infrastructure/repositories/prisma/index.js');
        const prisma = await criarRepositoriosPrisma();
        opcoes.repositorios = prisma.repositorios;
        encerrarBanco = prisma.encerrar;
        logger.info('Usando PostgreSQL via Prisma');
    } else {
        const quantidade = Number(process.env['PROFISSIONAIS_MEMORIA'] ?? 10_000);
        opcoes.profissionais = gerarProfissionais(quantidade);
        logger.info('Usando repositório em memória', { profissionais: quantidade });
    }

    const app = buildApp(criarContainer(opcoes), { logger: pinoLogger });

    const encerrar = async (): Promise<void> => {
        await app.close();
        await encerrarBanco();
        process.exit(0);
    };
    process.once('SIGINT', () => void encerrar());
    process.once('SIGTERM', () => void encerrar());

    await app.listen({ port: Number(process.env['PORT'] ?? 3000), host: process.env['HOST'] ?? '0.0.0.0' });
}

/** O cálculo de recomendação usa CPU; vários processos aproveitam todos os núcleos da máquina. */
function iniciarCluster(workers: number): void {
    cluster.schedulingPolicy = cluster.SCHED_RR; // distribui as conexões de forma igual (inclusive no Windows)
    for (let i = 0; i < workers; i++) cluster.fork();
    cluster.on('exit', (worker, codigo) => {
        if (codigo !== 0) {
            console.error(`Worker ${worker.process.pid} caiu (código ${codigo}); iniciando outro`);
            cluster.fork();
        }
    });
    const parar = (): void => {
        for (const worker of Object.values(cluster.workers ?? {})) worker?.kill();
        process.exit(0);
    };
    process.once('SIGINT', parar);
    process.once('SIGTERM', parar);
}

const workers = Number(process.env['WORKERS'] ?? 1);
if (workers > 1 && cluster.isPrimary) {
    iniciarCluster(workers);
} else {
    iniciar().catch((erro: unknown) => {
        console.error('Falha ao iniciar o CineBridge', erro);
        process.exit(1);
    });
}
