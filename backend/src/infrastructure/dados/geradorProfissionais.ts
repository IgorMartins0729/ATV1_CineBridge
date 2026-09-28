import { COMPETENCIA_POR_CAPTACAO, PERFIS_POR_PAPEL } from '../../domain/catalogo/perfisCompetencia.js';
import { Avaliacao } from '../../domain/entities/Avaliacao.js';
import { Competencia } from '../../domain/entities/Competencia.js';
import { Profissional } from '../../domain/entities/Profissional.js';
import { Papel } from '../../domain/enums/Papel.js';
import { TipoCaptacao } from '../../domain/enums/TipoCaptacao.js';
import { FaixaPreco } from '../../domain/value-objects/FaixaPreco.js';
import { Intervalo } from '../../domain/value-objects/Intervalo.js';
import { Localizacao } from '../../domain/value-objects/Localizacao.js';
import type { ProjetoAnterior } from '../../domain/value-objects/ProjetoAnterior.js';

const DIA_MS = 24 * 60 * 60 * 1000;

const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Heitor', 'Isabela', 'João',
    'Karina', 'Lucas', 'Marina', 'Nicolas', 'Olívia', 'Pedro', 'Rafaela', 'Samuel', 'Tainá', 'Vinícius'];
const SOBRENOMES = ['Almeida', 'Barbosa', 'Cardoso', 'Duarte', 'Esteves', 'Ferreira', 'Gomes', 'Honorato',
    'Lima', 'Moraes', 'Nogueira', 'Oliveira', 'Pereira', 'Queiroz', 'Ribeiro', 'Santos', 'Teixeira', 'Vieira'];
const CIDADES: Array<[string, string]> = [
    ['São Paulo', 'SP'], ['Campinas', 'SP'], ['Rio de Janeiro', 'RJ'], ['Belo Horizonte', 'MG'],
    ['Recife', 'PE'], ['Salvador', 'BA'], ['Porto Alegre', 'RS'], ['Curitiba', 'PR'],
    ['Fortaleza', 'CE'], ['Brasília', 'DF']
];
export const GENEROS = ['drama', 'comedia', 'suspense', 'terror', 'romance', 'aventura', 'biografia', 'musical'];
const TIPOS = [TipoCaptacao.DOCUMENTARIO, TipoCaptacao.FICCAO, TipoCaptacao.ANIMACAO];
const PAPEIS = Object.values(Papel);

/** Faixa de preço típica por papel [mínimo, máximo] em reais. */
const PRECO_BASE: Record<Papel, [number, number]> = {
    [Papel.DIRETOR]: [15_000, 60_000],
    [Papel.DIRETOR_FOTOGRAFIA]: [10_000, 40_000],
    [Papel.SONOPLASTA]: [4_000, 15_000],
    [Papel.EDITOR]: [5_000, 20_000],
    [Papel.ROTEIRISTA]: [6_000, 25_000],
    [Papel.EFEITOS_VISUAIS]: [8_000, 35_000]
};

/** PRNG determinístico (mulberry32): a mesma semente gera sempre os mesmos profissionais. */
function criarAleatorio(semente: number): () => number {
    let estado = semente >>> 0;
    return () => {
        estado = (estado + 0x6d2b79f5) >>> 0;
        let t = estado;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export interface OpcoesGerador {
    semente?: number;
    /** Data de referência para montar as janelas de disponibilidade. */
    referencia?: Date;
}

export function gerarProfissionais(quantidade: number, opcoes: OpcoesGerador = {}): Profissional[] {
    const aleatorio = criarAleatorio(opcoes.semente ?? 42);
    const referencia = (opcoes.referencia ?? new Date()).getTime();
    const inteiro = (min: number, max: number): number => Math.floor(min + aleatorio() * (max - min + 1));
    const escolher = <T>(lista: readonly T[]): T => lista[Math.floor(aleatorio() * lista.length)] as T;
    const limitar = (valor: number): number => Math.max(0, Math.min(10, Math.round(valor)));

    const profissionais: Profissional[] = [];
    for (let i = 0; i < quantidade; i++) {
        const principal = PAPEIS[i % PAPEIS.length] as Papel;
        const especialidades = [principal];
        if (aleatorio() < 0.3) {
            const secundario = escolher(PAPEIS);
            if (secundario !== principal) especialidades.push(secundario);
        }

        const niveis = new Map<string, number>();
        for (const papel of especialidades) {
            const talento = aleatorio() * 4 - 2;
            for (const [nome, ideal] of Object.entries(PERFIS_POR_PAPEL[papel])) {
                const nivel = limitar(ideal * (0.5 + aleatorio() * 0.5) + talento);
                niveis.set(nome, Math.max(niveis.get(nome) ?? 0, nivel));
            }
        }
        for (const tipo of TIPOS) {
            niveis.set(COMPETENCIA_POR_CAPTACAO[tipo], inteiro(0, 10));
        }

        const qualidade = 2.5 + aleatorio() * 2.5;
        const avaliacoes = Array.from({ length: inteiro(0, 12) }, () => {
            const nota = Math.max(0, Math.min(5, Math.round((qualidade + aleatorio() * 1.6 - 0.8) * 2) / 2));
            return new Avaliacao(nota, 'Avaliação gerada', new Date(referencia - inteiro(10, 900) * DIA_MS));
        });

        const historico: ProjetoAnterior[] = Array.from({ length: inteiro(0, 8) }, (_, n) => ({
            titulo: `Projeto ${i}-${n}`,
            genero: escolher(GENEROS),
            tipoCaptacao: escolher(TIPOS),
            ano: inteiro(2015, 2026)
        }));

        const [precoMin, precoMax] = PRECO_BASE[principal];
        const minimo = Math.round((precoMin + aleatorio() * (precoMax - precoMin)) / 100) * 100;
        const [cidade, uf] = escolher(CIDADES);
        const nome = `${escolher(NOMES)} ${escolher(SOBRENOMES)}`;
        const id = `prof-${String(i + 1).padStart(5, '0')}`;

        profissionais.push(
            new Profissional({
                id,
                nome,
                email: `${id}@cinebridge.dev`,
                especialidades,
                competencias: [...niveis].map(([nomeCompetencia, nivel]) => new Competencia(nomeCompetencia, nivel)),
                avaliacoes,
                historicoProjetos: historico,
                faixaPreco: new FaixaPreco(minimo, Math.round(minimo * (1.1 + aleatorio() * 0.4))),
                disponibilidade: new Intervalo(
                    new Date(referencia - inteiro(0, 60) * DIA_MS),
                    new Date(referencia + inteiro(30, 720) * DIA_MS)
                ),
                localizacao: new Localizacao(cidade, uf)
            })
        );
    }
    return profissionais;
}
