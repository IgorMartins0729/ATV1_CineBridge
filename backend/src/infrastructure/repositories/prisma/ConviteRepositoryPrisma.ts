import type { Prisma, PrismaClient } from '@prisma/client';
import type { IConviteRepository } from '../../../application/ports/IConviteRepository.js';
import { Convite } from '../../../domain/entities/Convite.js';
import type { Papel } from '../../../domain/enums/Papel.js';
import type { StatusConvite } from '../../../domain/enums/StatusConvite.js';
import { INCLUIR_PROFISSIONAL, paraPapelPrisma, paraProfissional } from './mapeadores.js';

const INCLUIR_CONVITE = { profissional: { include: INCLUIR_PROFISSIONAL } } satisfies Prisma.ConviteInclude;
type ConviteCompleto = Prisma.ConviteGetPayload<{ include: typeof INCLUIR_CONVITE }>;

export class ConviteRepositoryPrisma implements IConviteRepository {
    private readonly prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    public async salvar(convite: Convite): Promise<void> {
        const dados = {
            status: convite.getStatus() as unknown as Prisma.ConviteCreateInput['status'],
            respondidoEm: convite.getRespondidoEm()
        };
        await this.prisma.convite.upsert({
            where: { id: convite.getId() },
            create: {
                id: convite.getId(),
                projetoId: convite.getProjetoId(),
                papel: paraPapelPrisma(convite.getPapel()),
                profissionalId: convite.getProfissional().getId(),
                criadoEm: convite.getCriadoEm(),
                ...dados
            },
            update: dados
        });
    }

    public async buscarPorId(id: string): Promise<Convite | null> {
        const linha = await this.prisma.convite.findUnique({ where: { id }, include: INCLUIR_CONVITE });
        return linha ? paraConvite(linha) : null;
    }

    public async listarPorProjeto(projetoId: string): Promise<Convite[]> {
        const linhas = await this.prisma.convite.findMany({
            where: { projetoId },
            include: INCLUIR_CONVITE,
            orderBy: { criadoEm: 'asc' }
        });
        return linhas.map(paraConvite);
    }
}

function paraConvite(linha: ConviteCompleto): Convite {
    return new Convite({
        id: linha.id,
        projetoId: linha.projetoId,
        papel: linha.papel as unknown as Papel,
        profissional: paraProfissional(linha.profissional),
        status: linha.status as unknown as StatusConvite,
        criadoEm: linha.criadoEm,
        respondidoEm: linha.respondidoEm
    });
}
