import { describe, expect, it } from 'vitest';
import { FiltragemColaborativa } from '../../../src/application/strategies/FiltragemColaborativa.js';
import type { RecomendacaoStrategy } from '../../../src/application/strategies/RecomendacaoStrategy.js';
import { RegistroEstrategias } from '../../../src/application/strategies/RegistroEstrategias.js';
import { RegrasOrcamento } from '../../../src/application/strategies/RegrasOrcamento.js';
import { SimilaridadeCosseno, similaridadeCosseno } from '../../../src/application/strategies/SimilaridadeCosseno.js';
import { Papel } from '../../../src/domain/enums/Papel.js';
import { TipoCaptacao } from '../../../src/domain/enums/TipoCaptacao.js';
import { ValidacaoError } from '../../../src/domain/erros.js';
import { criarProfissional, criarProjeto } from '../../fixtures/fabricas.js';

/**
 * Cenário pensado para que cada estratégia escolha um vencedor diferente:
 * - "tecnico": competências idênticas ao perfil ideal, avaliações medianas, caro.
 * - "veterano": competências fracas, excelentes avaliações e experiência em dramas de ficção, caro.
 * - "economico": competências médias, barato e da mesma cidade do projeto.
 */
const tecnico = criarProfissional({
    id: 'tecnico',
    competencias: { direcao: 10, roteiro: 6, fotografia: 5, montagem: 4, ficcao: 8 },
    notas: [3, 3, 3],
    preco: 50_000,
    cidade: 'Rio de Janeiro',
    uf: 'RJ'
});
const veterano = criarProfissional({
    id: 'veterano',
    competencias: { direcao: 4, roteiro: 2 },
    notas: [5, 5, 5, 5, 5, 5],
    historico: [
        { titulo: 'A', genero: 'drama', tipoCaptacao: TipoCaptacao.FICCAO, ano: 2022 },
        { titulo: 'B', genero: 'drama', tipoCaptacao: TipoCaptacao.FICCAO, ano: 2023 }
    ],
    preco: 40_000,
    cidade: 'Rio de Janeiro',
    uf: 'RJ'
});
const economico = criarProfissional({
    id: 'economico',
    competencias: { direcao: 6 },
    notas: [3.5],
    preco: 8_000,
    cidade: 'São Paulo',
    uf: 'SP'
});
const semEspecialidade = criarProfissional({ id: 'editor', especialidades: [Papel.EDITOR] });
const profissionais = [tecnico, veterano, economico, semEspecialidade];
const projeto = criarProjeto({ orcamento: 20_000, papeis: [[Papel.DIRETOR, 1]], genero: 'drama' });

function vencedor(estrategia: RecomendacaoStrategy): string | undefined {
    return estrategia.recomendar(projeto, profissionais).get(Papel.DIRETOR)?.[0]?.profissional.getId();
}

describe('Strategy: troca de estratégia altera o resultado', () => {
    it('a mesma entrada gera um vencedor diferente em cada estratégia', () => {
        expect(vencedor(new SimilaridadeCosseno())).toBe('tecnico');
        expect(vencedor(new FiltragemColaborativa())).toBe('veterano');
        expect(vencedor(new RegrasOrcamento())).toBe('economico');
    });

    it('todas respeitam a especialidade e devolvem pontuações entre 0 e 1 em ordem decrescente', () => {
        for (const estrategia of [new SimilaridadeCosseno(), new FiltragemColaborativa(), new RegrasOrcamento()]) {
            const lista = estrategia.recomendar(projeto, profissionais).get(Papel.DIRETOR) ?? [];
            expect(lista.map((c) => c.profissional.getId())).not.toContain('editor');
            for (const [i, candidato] of lista.entries()) {
                expect(candidato.pontuacao).toBeGreaterThanOrEqual(0);
                expect(candidato.pontuacao).toBeLessThanOrEqual(1);
                if (i > 0) expect(candidato.pontuacao).toBeLessThanOrEqual(lista[i - 1]!.pontuacao);
            }
        }
    });

    it('recomenda apenas os papéis pedidos', () => {
        const projetoDois = criarProjeto({ papeis: [[Papel.DIRETOR, 1], [Papel.EDITOR, 1]] });
        const ranking = new SimilaridadeCosseno().recomendar(projetoDois, profissionais, [Papel.EDITOR]);
        expect([...ranking.keys()]).toEqual([Papel.EDITOR]);
        expect(ranking.get(Papel.EDITOR)?.[0]?.profissional.getId()).toBe('editor');
    });
});

describe('SimilaridadeCosseno', () => {
    it('calcula o cosseno entre vetores', () => {
        expect(similaridadeCosseno([1, 0], [1, 0])).toBeCloseTo(1);
        expect(similaridadeCosseno([1, 0], [0, 1])).toBeCloseTo(0);
        expect(similaridadeCosseno([2, 4], [1, 2])).toBeCloseTo(1);
        expect(similaridadeCosseno([0, 0], [1, 1])).toBe(0);
        expect(similaridadeCosseno([1], [1, 1])).toBeCloseTo(Math.SQRT1_2);
    });

    it('é parametrizável: sem peso de magnitude, um perfil proporcional porém fraco empata com o forte', () => {
        const fraco = criarProfissional({
            id: 'fraco',
            competencias: { direcao: 5, roteiro: 3, fotografia: 2.5, montagem: 2, ficcao: 4 }
        });
        const soCosseno = new SimilaridadeCosseno({ pesoMagnitude: 0 }).recomendar(projeto, [tecnico, fraco]);
        const [a, b] = soCosseno.get(Papel.DIRETOR) ?? [];
        expect(a?.pontuacao).toBeCloseTo(b?.pontuacao ?? -1);

        const comMagnitude = new SimilaridadeCosseno({ pesoMagnitude: 0.5 }).recomendar(projeto, [tecnico, fraco]);
        expect(comMagnitude.get(Papel.DIRETOR)?.[0]?.profissional.getId()).toBe('tecnico');
    });

    it('limita a quantidade de candidatos (topN)', () => {
        const ranking = new SimilaridadeCosseno({ topN: 1 }).recomendar(projeto, profissionais);
        expect(ranking.get(Papel.DIRETOR)).toHaveLength(1);
    });
});

describe('FiltragemColaborativa', () => {
    it('média bayesiana: poucas notas altas não vencem muitas notas altas', () => {
        const umaNota = criarProfissional({ id: 'uma', notas: [5] });
        const muitas = criarProfissional({ id: 'muitas', notas: Array(20).fill(4.8) });
        const ranking = new FiltragemColaborativa({ pesoGenero: 0, pesoTipoCaptacao: 0 }).recomendar(projeto, [
            umaNota,
            muitas
        ]);
        expect(ranking.get(Papel.DIRETOR)?.[0]?.profissional.getId()).toBe('muitas');
    });

    it('sem avaliações, usa a nota de referência (configurável)', () => {
        const semNotas = [criarProfissional({ notas: [] })];
        // 0,7 (peso das avaliações) x 3/5 (nota de referência)
        expect(new FiltragemColaborativa().recomendar(projeto, semNotas).get(Papel.DIRETOR)?.[0]?.pontuacao).toBeCloseTo(
            0.42
        );
        const zeroConfianca = new FiltragemColaborativa({ confiancaMinima: 0, notaReferencia: 5 });
        expect(zeroConfianca.recomendar(projeto, semNotas).get(Papel.DIRETOR)?.[0]?.pontuacao).toBeCloseTo(0.7);
    });
});

describe('RegrasOrcamento', () => {
    it('quando ninguém cabe na verba, mantém os mais baratos para o papel não ficar vazio', () => {
        const apertado = criarProjeto({ orcamento: 1_000, papeis: [[Papel.DIRETOR, 1]] });
        const ranking = new RegrasOrcamento({ minimoCandidatos: 2 }).recomendar(apertado, profissionais);
        expect(ranking.get(Papel.DIRETOR)?.map((c) => c.profissional.getId())).toEqual(['economico', 'veterano']);
    });

    it('prefere quem está perto do local de filmagem', () => {
        const local = criarProfissional({ id: 'local', preco: 5_000, notas: [4], cidade: 'São Paulo', uf: 'SP' });
        const mesmoEstado = criarProfissional({ id: 'estado', preco: 5_000, notas: [4], cidade: 'Campinas', uf: 'SP' });
        const longe = criarProfissional({ id: 'longe', preco: 5_000, notas: [4], cidade: 'Recife', uf: 'PE' });
        const ranking = new RegrasOrcamento().recomendar(projeto, [longe, mesmoEstado, local]);
        expect(ranking.get(Papel.DIRETOR)?.map((c) => c.profissional.getId())).toEqual(['local', 'estado', 'longe']);
    });
});

describe('RegistroEstrategias', () => {
    const registro = new RegistroEstrategias(
        [new SimilaridadeCosseno(), new FiltragemColaborativa(), new RegrasOrcamento()],
        { padrao: 'similaridade-cosseno', limiteOrcamentoReduzido: 50_000, estrategiaOrcamentoReduzido: 'regras-orcamento' }
    );

    it('obtém estratégias pelo nome e lista as disponíveis', () => {
        expect(registro.obter('filtragem-colaborativa')).toBeInstanceOf(FiltragemColaborativa);
        expect(registro.nomes()).toEqual(['similaridade-cosseno', 'filtragem-colaborativa', 'regras-orcamento']);
        expect(registro.listar()).toHaveLength(3);
        expect(registro.existe('regras-orcamento')).toBe(true);
        expect(() => registro.obter('aleatoria')).toThrow(ValidacaoError);
    });

    it('escolhe automaticamente pela faixa de orçamento', () => {
        expect(registro.selecionarAutomatica(criarProjeto({ orcamento: 30_000 })).nome).toBe('regras-orcamento');
        expect(registro.selecionarAutomatica(criarProjeto({ orcamento: 300_000 })).nome).toBe('similaridade-cosseno');
    });

    it('recusa configuração com estratégia inexistente', () => {
        expect(
            () =>
                new RegistroEstrategias([new SimilaridadeCosseno()], {
                    padrao: 'similaridade-cosseno',
                    limiteOrcamentoReduzido: 1,
                    estrategiaOrcamentoReduzido: 'nao-existe'
                })
        ).toThrow(ValidacaoError);
    });
});
