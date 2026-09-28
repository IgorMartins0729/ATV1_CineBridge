import type { PrismaClient } from '@prisma/client';
import type { IRecomendacaoRepository } from '../../../application/ports/IRecomendacaoRepository.js';
import type { Profissional } from '../../../domain/entities/Profissional.js';
import { Recomendacao, type Ranking } from '../../../domain/entities/Recomendacao.js';
import type { Papel } from '../../../domain/enums/Papel.js';
import { INCLUIR_PROFISSIONAL, paraPapelPrisma, paraProfissional } from './mapeadores.js';

type RankingJson = Record<string, Array<{ profissionalId: string; pontuacao: number }>>;

export class RecomendacaoRepositoryPrisma implements IRecomendacaoRepository {
    private readonly prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    public async salvar(recomendacao: Recomendacao): Promise<void> {
        const ranking: RankingJson = {};
        for (const papel of recomendacao.getPapeis()) {
            ranking[papel] = recomendacao.getCandidatos(papel).map((c) => ({
                profissionalId: c.profissional.getId(),
                pontuacao: c.pontuacao
            }));
        }
        await this.prisma.recomendacao.create({
            data: {
                id: recomendacao.getId(),
                projetoId: recomendacao.getProjetoId(),
                estrategia: recomendacao.getEstrategia(),
                parcial: recomendacao.isParcial(),
                papeisSemCandidatos: recomendacao.getPapeisSemCandidatos().map(paraPapelPrisma),
                ranking,
                geradaEm: recomendacao.getGeradaEm()
            }
        });
    }

    public async listarPorProjeto(projetoId: string): Promise<Recomendacao[]> {
        const linhas = await this.prisma.recomendacao.findMany({ where: { projetoId }, orderBy: { geradaEm: 'asc' } });
        const ids = new Set<string>();
        for (const linha of linhas) {
            for (const lista of Object.values(linha.ranking as RankingJson)) {
                for (const item of lista) ids.add(item.profissionalId);
            }
        }
        const profissionais = new Map<string, Profissional>();
        const encontrados = await this.prisma.profissional.findMany({
            where: { id: { in: [...ids] } },
            include: INCLUIR_PROFISSIONAL
        });
        for (const linha of encontrados) profissionais.set(linha.id, paraProfissional(linha));

        return linhas.map((linha) => {
            const ranking: Ranking = new Map();
            for (const [papel, lista] of Object.entries(linha.ranking as RankingJson)) {
                ranking.set(
                    papel as Papel,
                    lista.flatMap((item) => {
                        const profissional = profissionais.get(item.profissionalId);
                        return profissional ? [{ profissional, pontuacao: item.pontuacao }] : [];
                    })
                );
            }
            return new Recomendacao({
                id: linha.id,
                projetoId: linha.projetoId,
                estrategia: linha.estrategia,
                ranking,
                parcial: linha.parcial,
                papeisSemCandidatos: linha.papeisSemCandidatos as unknown as Papel[],
                geradaEm: linha.geradaEm
            });
        });
    }
}
