import type { Prisma, PrismaClient } from '@prisma/client';
import type { IProjetoRepository } from '../../../application/ports/IProjetoRepository.js';
import { Equipe } from '../../../domain/entities/Equipe.js';
import { MembroEquipe } from '../../../domain/entities/MembroEquipe.js';
import { Projeto } from '../../../domain/entities/Projeto.js';
import type { Papel } from '../../../domain/enums/Papel.js';
import type { StatusEquipe } from '../../../domain/enums/StatusEquipe.js';
import type { TipoCaptacao } from '../../../domain/enums/TipoCaptacao.js';
import { Localizacao } from '../../../domain/value-objects/Localizacao.js';
import { RequisitoPapel } from '../../../domain/value-objects/RequisitoPapel.js';
import { INCLUIR_PROFISSIONAL, paraCaptacaoPrisma, paraPapelPrisma, paraProfissional } from './mapeadores.js';

const INCLUIR_PROJETO = {
    papeis: true,
    equipe: { include: { membros: { include: { profissional: { include: INCLUIR_PROFISSIONAL } } } } }
} satisfies Prisma.ProjetoInclude;

type ProjetoCompleto = Prisma.ProjetoGetPayload<{ include: typeof INCLUIR_PROJETO }>;

export class ProjetoRepositoryPrisma implements IProjetoRepository {
    private readonly prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    public async buscarPorId(id: string): Promise<Projeto | null> {
        const linha = await this.prisma.projeto.findUnique({ where: { id }, include: INCLUIR_PROJETO });
        return linha ? this.paraProjeto(linha) : null;
    }

    /** Grava o agregado inteiro (projeto, papéis, equipe e membros) em uma transação. */
    public async salvar(projeto: Projeto): Promise<void> {
        const id = projeto.getId();
        const produtor = projeto.getProdutor();
        const dados = {
            titulo: projeto.getTitulo(),
            produtorId: produtor.id,
            produtorNome: produtor.nome,
            produtorEmail: produtor.email,
            genero: projeto.getGenero(),
            duracao: projeto.getDuracao(),
            orcamento: projeto.getOrcamento(),
            prazo: projeto.getPrazo(),
            tipoCaptacao: paraCaptacaoPrisma(projeto.getTipoCaptacao()),
            cidade: projeto.getLocalizacao().getCidade(),
            uf: projeto.getLocalizacao().getUf(),
            estrategia: projeto.getEstrategia(),
            rejeitados: [...projeto.getProfissionaisRejeitados()]
        };

        await this.prisma.$transaction(async (tx) => {
            await tx.projeto.upsert({ where: { id }, create: { id, ...dados }, update: dados });
            await tx.requisitoPapel.deleteMany({ where: { projetoId: id } });
            await tx.requisitoPapel.createMany({
                data: projeto.getPapeisObrigatorios().map((r) => ({
                    projetoId: id,
                    papel: paraPapelPrisma(r.getPapel()),
                    peso: r.getPeso()
                }))
            });

            const equipe = projeto.getEquipe();
            if (!equipe) {
                await tx.equipe.deleteMany({ where: { projetoId: id } });
                return;
            }
            await tx.equipe.deleteMany({ where: { projetoId: id, NOT: { id: equipe.getId() } } });
            const dadosEquipe = {
                status: equipe.getStatus() as unknown as Prisma.EquipeCreateInput['status'],
                dataFormacao: equipe.getDataFormacao()
            };
            await tx.equipe.upsert({
                where: { id: equipe.getId() },
                create: { id: equipe.getId(), projetoId: id, ...dadosEquipe },
                update: dadosEquipe
            });
            await tx.membroEquipe.deleteMany({ where: { equipeId: equipe.getId() } });
            await tx.membroEquipe.createMany({
                data: equipe.getMembros().map((m) => ({
                    equipeId: equipe.getId(),
                    papel: paraPapelPrisma(m.getPapel()),
                    profissionalId: m.getProfissional().getId(),
                    confirmado: m.getConfirmado()
                }))
            });
        });
    }

    private paraProjeto(linha: ProjetoCompleto): Projeto {
        const equipe = linha.equipe
            ? new Equipe(
                  linha.equipe.id,
                  linha.equipe.membros.map(
                      (m) => new MembroEquipe(m.papel as unknown as Papel, paraProfissional(m.profissional), m.confirmado)
                  ),
                  linha.equipe.status as unknown as StatusEquipe,
                  linha.equipe.dataFormacao
              )
            : null;
        return new Projeto({
            id: linha.id,
            titulo: linha.titulo,
            produtor: { id: linha.produtorId, nome: linha.produtorNome, email: linha.produtorEmail },
            genero: linha.genero,
            duracao: linha.duracao,
            orcamento: linha.orcamento,
            prazo: linha.prazo,
            tipoCaptacao: linha.tipoCaptacao as unknown as TipoCaptacao,
            localizacao: new Localizacao(linha.cidade, linha.uf),
            papeisObrigatorios: linha.papeis.map((r) => new RequisitoPapel(r.papel as unknown as Papel, r.peso)),
            estrategia: linha.estrategia,
            equipe,
            profissionaisRejeitados: linha.rejeitados
        });
    }
}
