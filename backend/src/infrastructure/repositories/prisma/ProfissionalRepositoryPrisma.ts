import type { Prisma, PrismaClient } from '@prisma/client';
import type { FiltroCandidatos, IProfissionalRepository } from '../../../application/ports/IProfissionalRepository.js';
import type { Profissional } from '../../../domain/entities/Profissional.js';
import {
    dadosFilhosProfissional,
    dadosProfissional,
    INCLUIR_PROFISSIONAL,
    paraPapelPrisma,
    paraProfissional
} from './mapeadores.js';

export class ProfissionalRepositoryPrisma implements IProfissionalRepository {
    private readonly prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    public async listarTodos(): Promise<Profissional[]> {
        const linhas = await this.prisma.profissional.findMany({ include: INCLUIR_PROFISSIONAL });
        return linhas.map(paraProfissional);
    }

    public async buscarPorId(id: string): Promise<Profissional | null> {
        const linha = await this.prisma.profissional.findUnique({ where: { id }, include: INCLUIR_PROFISSIONAL });
        return linha ? paraProfissional(linha) : null;
    }

    /** O filtro roda no banco (índices GIN em especialidades, disponibilidade e preço). */
    public async buscarCandidatos(filtro: FiltroCandidatos): Promise<Profissional[]> {
        const where: Prisma.ProfissionalWhereInput = {
            especialidades: { hasSome: filtro.papeis.map(paraPapelPrisma) }
        };
        if (filtro.disponivelEm) {
            where.disponivelDe = { lte: filtro.disponivelEm };
            where.disponivelAte = { gte: filtro.disponivelEm };
        }
        if (filtro.precoMaximo !== undefined) {
            where.precoMedio = { lte: filtro.precoMaximo };
        }
        if (filtro.excluirIds && filtro.excluirIds.length > 0) {
            where.id = { notIn: [...filtro.excluirIds] };
        }
        const linhas = await this.prisma.profissional.findMany({ where, include: INCLUIR_PROFISSIONAL });
        return linhas.map(paraProfissional);
    }

    public async salvar(profissional: Profissional): Promise<void> {
        const dados = dadosProfissional(profissional);
        const filhos = dadosFilhosProfissional(profissional);
        const id = profissional.getId();
        await this.prisma.$transaction([
            this.prisma.profissional.upsert({ where: { id }, create: dados, update: dados }),
            this.prisma.competencia.deleteMany({ where: { profissionalId: id } }),
            this.prisma.avaliacao.deleteMany({ where: { profissionalId: id } }),
            this.prisma.projetoAnterior.deleteMany({ where: { profissionalId: id } }),
            this.prisma.competencia.createMany({ data: filhos.competencias }),
            this.prisma.avaliacao.createMany({ data: filhos.avaliacoes }),
            this.prisma.projetoAnterior.createMany({ data: filhos.historico })
        ]);
    }

    public async contar(): Promise<number> {
        return this.prisma.profissional.count();
    }
}
