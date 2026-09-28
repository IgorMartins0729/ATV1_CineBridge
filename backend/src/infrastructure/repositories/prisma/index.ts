import { PrismaClient } from '@prisma/client';
import { ConviteRepositoryPrisma } from './ConviteRepositoryPrisma.js';
import { ProfissionalRepositoryPrisma } from './ProfissionalRepositoryPrisma.js';
import { ProjetoRepositoryPrisma } from './ProjetoRepositoryPrisma.js';
import { RecomendacaoRepositoryPrisma } from './RecomendacaoRepositoryPrisma.js';

/** Conecta no PostgreSQL (DATABASE_URL) e cria as implementações Prisma dos repositórios. */
export async function criarRepositoriosPrisma() {
    const prisma = new PrismaClient();
    await prisma.$connect();
    return {
        repositorios: {
            profissionais: new ProfissionalRepositoryPrisma(prisma),
            projetos: new ProjetoRepositoryPrisma(prisma),
            convites: new ConviteRepositoryPrisma(prisma),
            recomendacoes: new RecomendacaoRepositoryPrisma(prisma)
        },
        encerrar: () => prisma.$disconnect()
    };
}
