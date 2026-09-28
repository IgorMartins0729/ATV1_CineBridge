import type { $Enums, Prisma } from '@prisma/client';
import { Avaliacao } from '../../../domain/entities/Avaliacao.js';
import { Competencia } from '../../../domain/entities/Competencia.js';
import { Profissional } from '../../../domain/entities/Profissional.js';
import type { Papel } from '../../../domain/enums/Papel.js';
import type { TipoCaptacao } from '../../../domain/enums/TipoCaptacao.js';
import { FaixaPreco } from '../../../domain/value-objects/FaixaPreco.js';
import { Intervalo } from '../../../domain/value-objects/Intervalo.js';
import { Localizacao } from '../../../domain/value-objects/Localizacao.js';

export const INCLUIR_PROFISSIONAL = {
    competencias: true,
    avaliacoes: true,
    historico: true
} satisfies Prisma.ProfissionalInclude;

export type ProfissionalCompleto = Prisma.ProfissionalGetPayload<{ include: typeof INCLUIR_PROFISSIONAL }>;

/** Os enums do Prisma e do domínio têm os mesmos valores; só o tipo TypeScript é diferente. */
export const paraPapelPrisma = (papel: Papel): $Enums.Papel => papel as unknown as $Enums.Papel;
export const paraCaptacaoPrisma = (tipo: TipoCaptacao): $Enums.TipoCaptacao => tipo as unknown as $Enums.TipoCaptacao;

export function paraProfissional(linha: ProfissionalCompleto): Profissional {
    return new Profissional({
        id: linha.id,
        nome: linha.nome,
        email: linha.email,
        especialidades: linha.especialidades as unknown as Papel[],
        competencias: linha.competencias.map((c) => new Competencia(c.nome, c.nivel)),
        avaliacoes: linha.avaliacoes.map((a) => new Avaliacao(a.nota, a.comentario, a.data)),
        historicoProjetos: linha.historico.map((h) => ({
            titulo: h.titulo,
            genero: h.genero,
            tipoCaptacao: h.tipoCaptacao as unknown as TipoCaptacao,
            ano: h.ano
        })),
        faixaPreco: new FaixaPreco(linha.precoMinimo, linha.precoMaximo),
        disponibilidade: new Intervalo(linha.disponivelDe, linha.disponivelAte),
        localizacao: new Localizacao(linha.cidade, linha.uf)
    });
}

export function dadosProfissional(profissional: Profissional): Prisma.ProfissionalCreateManyInput {
    const faixa = profissional.getFaixaPreco();
    const disponibilidade = profissional.getDisponibilidade();
    return {
        id: profissional.getId(),
        nome: profissional.getNome(),
        email: profissional.getEmail(),
        especialidades: profissional.getEspecialidades().map(paraPapelPrisma),
        precoMinimo: faixa.getMinimo(),
        precoMaximo: faixa.getMaximo(),
        precoMedio: faixa.getMedia(),
        disponivelDe: disponibilidade.getInicio(),
        disponivelAte: disponibilidade.getFim(),
        cidade: profissional.getLocalizacao().getCidade(),
        uf: profissional.getLocalizacao().getUf()
    };
}

export function dadosFilhosProfissional(profissional: Profissional) {
    const profissionalId = profissional.getId();
    return {
        competencias: profissional.getCompetencias().map((c) => ({ profissionalId, nome: c.getNome(), nivel: c.getNivel() })),
        avaliacoes: profissional.getAvaliacoes().map((a) => ({
            profissionalId,
            nota: a.getNota(),
            comentario: a.getComentario(),
            data: a.getData()
        })),
        historico: profissional.getHistoricoProjetos().map((h) => ({
            profissionalId,
            titulo: h.titulo,
            genero: h.genero,
            tipoCaptacao: paraCaptacaoPrisma(h.tipoCaptacao),
            ano: h.ano
        }))
    };
}
