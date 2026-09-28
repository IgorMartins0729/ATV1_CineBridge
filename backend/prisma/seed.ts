import { PrismaClient } from '@prisma/client';
import { gerarProfissionais } from '../src/infrastructure/dados/geradorProfissionais.js';
import { dadosFilhosProfissional, dadosProfissional } from '../src/infrastructure/repositories/prisma/mapeadores.js';

/**
 * Popula o banco com profissionais fictícios (padrão: 10.000, requisito de desempenho).
 * Uso: npx prisma db seed   (ou QUANTIDADE_PROFISSIONAIS=500 npx prisma db seed)
 */
const QUANTIDADE = Number(process.env['QUANTIDADE_PROFISSIONAIS'] ?? 10_000);
const LOTE = 1_000;

async function main(): Promise<void> {
    const prisma = new PrismaClient();
    try {
        console.log('Limpando dados anteriores...');
        await prisma.$transaction([
            prisma.recomendacao.deleteMany(),
            prisma.convite.deleteMany(),
            prisma.membroEquipe.deleteMany(),
            prisma.equipe.deleteMany(),
            prisma.requisitoPapel.deleteMany(),
            prisma.projeto.deleteMany(),
            prisma.competencia.deleteMany(),
            prisma.avaliacao.deleteMany(),
            prisma.projetoAnterior.deleteMany(),
            prisma.profissional.deleteMany()
        ]);

        const profissionais = gerarProfissionais(QUANTIDADE);
        for (let i = 0; i < profissionais.length; i += LOTE) {
            const lote = profissionais.slice(i, i + LOTE);
            const filhos = lote.map(dadosFilhosProfissional);
            await prisma.$transaction([
                prisma.profissional.createMany({ data: lote.map(dadosProfissional) }),
                prisma.competencia.createMany({ data: filhos.flatMap((f) => f.competencias) }),
                prisma.avaliacao.createMany({ data: filhos.flatMap((f) => f.avaliacoes) }),
                prisma.projetoAnterior.createMany({ data: filhos.flatMap((f) => f.historico) })
            ]);
            console.log(`  ${Math.min(i + LOTE, profissionais.length)}/${profissionais.length} profissionais`);
        }
        console.log('Seed concluído.');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((erro: unknown) => {
    console.error(erro);
    process.exit(1);
});
