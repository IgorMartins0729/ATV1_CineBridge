import { spawn } from 'node:child_process';
import autocannon from 'autocannon';

/**
 * Teste de carga dos requisitos não funcionais:
 * - recomendação em menos de 2 s com 10.000 profissionais ativos
 * - pelo menos 100 requisições simultâneas
 *
 * O servidor sobe em um processo separado (como em produção) para o gerador de carga
 * não disputar a mesma CPU/thread com a API.
 *
 * Uso: npm run carga   (CONEXOES=100 DURACAO=20 PROFISSIONAIS=10000 npm run carga)
 */
const PROFISSIONAIS = process.env['PROFISSIONAIS'] ?? '10000';
const CONEXOES = Number(process.env['CONEXOES'] ?? 100);
const DURACAO = Number(process.env['DURACAO'] ?? 15);
const PORTA = process.env['PORTA_CARGA'] ?? '3099';
/** Processos do servidor. O endpoint testado cria e recomenda na mesma requisição, então vale em qualquer worker. */
const WORKERS = process.env['WORKERS'] ?? '4';
const LIMITE_MS = 2_000;
const URL_BASE = `http://127.0.0.1:${PORTA}`;

const prazo = new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);
const corpo = JSON.stringify({
    titulo: 'Teste de carga',
    produtor: { id: 'carga', nome: 'Carga', email: 'carga@cinebridge.dev' },
    genero: 'drama',
    duracao: 90,
    orcamento: 200_000,
    prazo,
    tipoCaptacao: 'FICCAO',
    localizacao: { cidade: 'São Paulo', uf: 'SP' },
    papeisObrigatorios: [
        { papel: 'DIRETOR', peso: 3 },
        { papel: 'DIRETOR_FOTOGRAFIA', peso: 2 },
        { papel: 'ROTEIRISTA', peso: 2 },
        { papel: 'EDITOR', peso: 1 },
        { papel: 'SONOPLASTA', peso: 1 },
        { papel: 'EFEITOS_VISUAIS', peso: 1 }
    ]
});

async function aguardarServidor(tentativas = 60): Promise<void> {
    for (let i = 0; i < tentativas; i++) {
        try {
            const resposta = await fetch(`${URL_BASE}/health`);
            if (resposta.ok) return;
        } catch {
            // ainda subindo
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error('Servidor não respondeu a tempo');
}

async function main(): Promise<void> {
    console.log(`Subindo o CineBridge com ${PROFISSIONAIS} profissionais em memória e ${WORKERS} worker(s)...`);
    const servidor = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
        env: {
            ...process.env,
            PORT: PORTA,
            HOST: '127.0.0.1',
            LOG_LEVEL: 'warn',
            PROFISSIONAIS_MEMORIA: PROFISSIONAIS,
            WORKERS
        },
        stdio: ['ignore', 'inherit', 'inherit']
    });

    try {
        await aguardarServidor();
        // Espera todos os workers subirem e aquece o JIT antes de medir.
        await new Promise((resolve) => setTimeout(resolve, 3_000));
        await autocannon({
            url: `${URL_BASE}/projetos/recomendacoes`,
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: corpo,
            connections: 20,
            amount: 400
        });

        console.log(`Disparando ${CONEXOES} conexões simultâneas por ${DURACAO}s em POST /projetos/recomendacoes`);
        const resultado = await autocannon({
            url: `${URL_BASE}/projetos/recomendacoes`,
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: corpo,
            connections: CONEXOES,
            duration: DURACAO
        });

        const { latency, requests, non2xx, errors, timeouts } = resultado;
        console.table({
            'requisições concluídas': requests.total,
            'requisições/s (média)': requests.average,
            'latência média (ms)': latency.average,
            'latência p50 (ms)': latency.p50,
            'latência p97,5 (ms)': latency.p97_5,
            'latência p99 (ms)': latency.p99,
            'latência máxima (ms)': latency.max,
            'respostas não-2xx': non2xx,
            erros: errors,
            timeouts
        });

        const aprovado = latency.p99 < LIMITE_MS && non2xx === 0 && errors === 0 && timeouts === 0;
        console.log(
            aprovado
                ? `APROVADO: p99 = ${latency.p99} ms < ${LIMITE_MS} ms com ${CONEXOES} conexões simultâneas`
                : `REPROVADO: p99 = ${latency.p99} ms (limite ${LIMITE_MS} ms), não-2xx = ${non2xx}, erros = ${errors}`
        );
        process.exitCode = aprovado ? 0 : 1;
    } finally {
        servidor.kill();
    }
}

main().catch((erro: unknown) => {
    console.error(erro);
    process.exitCode = 1;
});
