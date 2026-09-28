import { Avaliacao } from '../../src/domain/entities/Avaliacao.js';
import { Competencia } from '../../src/domain/entities/Competencia.js';
import { Profissional } from '../../src/domain/entities/Profissional.js';
import { Projeto } from '../../src/domain/entities/Projeto.js';
import { Papel } from '../../src/domain/enums/Papel.js';
import { TipoCaptacao } from '../../src/domain/enums/TipoCaptacao.js';
import { FaixaPreco } from '../../src/domain/value-objects/FaixaPreco.js';
import { Intervalo } from '../../src/domain/value-objects/Intervalo.js';
import { Localizacao } from '../../src/domain/value-objects/Localizacao.js';
import type { ProjetoAnterior } from '../../src/domain/value-objects/ProjetoAnterior.js';
import { RequisitoPapel } from '../../src/domain/value-objects/RequisitoPapel.js';

/** "Hoje" fixo usado nos testes para que datas não dependam do relógio. */
export const HOJE = new Date('2027-01-10T12:00:00Z');
export const PRAZO_PADRAO = new Date('2027-06-30T00:00:00Z');

export interface OpcoesProfissional {
    id?: string;
    nome?: string;
    especialidades?: Papel[];
    competencias?: Record<string, number>;
    notas?: number[];
    preco?: number;
    cidade?: string;
    uf?: string;
    disponivelDe?: Date;
    disponivelAte?: Date;
    historico?: ProjetoAnterior[];
}

let sequencia = 0;

export function criarProfissional(opcoes: OpcoesProfissional = {}): Profissional {
    sequencia += 1;
    const id = opcoes.id ?? `prof-${sequencia}`;
    const preco = opcoes.preco ?? 10_000;
    return new Profissional({
        id,
        nome: opcoes.nome ?? `Profissional ${id}`,
        email: `${id}@cinebridge.test`,
        especialidades: opcoes.especialidades ?? [Papel.DIRETOR],
        competencias: Object.entries(opcoes.competencias ?? { direcao: 8 }).map(
            ([nome, nivel]) => new Competencia(nome, nivel)
        ),
        avaliacoes: (opcoes.notas ?? [4]).map((nota) => new Avaliacao(nota, 'ok', new Date('2026-05-01'))),
        historicoProjetos: opcoes.historico ?? [],
        faixaPreco: new FaixaPreco(preco * 0.9, preco * 1.1),
        disponibilidade: new Intervalo(
            opcoes.disponivelDe ?? new Date('2026-01-01'),
            opcoes.disponivelAte ?? new Date('2028-01-01')
        ),
        localizacao: new Localizacao(opcoes.cidade ?? 'São Paulo', opcoes.uf ?? 'SP')
    });
}

export interface OpcoesProjeto {
    id?: string;
    titulo?: string;
    genero?: string;
    orcamento?: number;
    prazo?: Date;
    tipoCaptacao?: TipoCaptacao;
    cidade?: string;
    uf?: string;
    papeis?: Array<[Papel, number]>;
    estrategia?: string;
}

export function criarProjeto(opcoes: OpcoesProjeto = {}): Projeto {
    return new Projeto({
        ...(opcoes.id !== undefined ? { id: opcoes.id } : {}),
        titulo: opcoes.titulo ?? 'Curta de Teste',
        produtor: { id: 'produtor-1', nome: 'Ana Produtora', email: 'ana@produtora.test' },
        genero: opcoes.genero ?? 'drama',
        duracao: 90,
        orcamento: opcoes.orcamento ?? 100_000,
        prazo: opcoes.prazo ?? PRAZO_PADRAO,
        tipoCaptacao: opcoes.tipoCaptacao ?? TipoCaptacao.FICCAO,
        localizacao: new Localizacao(opcoes.cidade ?? 'São Paulo', opcoes.uf ?? 'SP'),
        papeisObrigatorios: (opcoes.papeis ?? [[Papel.DIRETOR, 3]]).map(
            ([papel, peso]) => new RequisitoPapel(papel, peso)
        ),
        estrategia: opcoes.estrategia ?? null
    });
}
