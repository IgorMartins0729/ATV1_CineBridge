import { describe, expect, it } from 'vitest';
import { OrquestradorEquipe } from '../../../src/application/orquestrador/OrquestradorEquipe.js';
import { OrquestradorPadrao } from '../../../src/application/orquestrador/OrquestradorPadrao.js';
import type { RecomendacaoStrategy } from '../../../src/application/strategies/RecomendacaoStrategy.js';
import { SimilaridadeCosseno } from '../../../src/application/strategies/SimilaridadeCosseno.js';
import type { Profissional } from '../../../src/domain/entities/Profissional.js';
import type { Projeto } from '../../../src/domain/entities/Projeto.js';
import type { Ranking } from '../../../src/domain/entities/Recomendacao.js';
import { Papel } from '../../../src/domain/enums/Papel.js';
import { RestricaoInvalidaError } from '../../../src/domain/erros.js';
import { criarProfissional, criarProjeto, HOJE } from '../../fixtures/fabricas.js';

/** Subclasse de teste que só registra a ordem em que o template chama as etapas. */
class OrquestradorEspiao extends OrquestradorEquipe {
    readonly chamadas: string[] = [];
    problemas: string[] = [];

    constructor() {
        super({ quantidadeSugestoes: 1 });
    }

    protected validarRestricoes(): string[] {
        this.chamadas.push('validarRestricoes');
        return this.problemas;
    }

    protected normalizarDados(_projeto: Projeto, profissionais: readonly Profissional[]): Profissional[] {
        this.chamadas.push('normalizarDados');
        return [...profissionais];
    }

    protected posProcessar(_projeto: Projeto, ranking: Ranking): Ranking {
        this.chamadas.push('posProcessar');
        return ranking;
    }
}

function estrategiaEspia(chamadas: string[]): RecomendacaoStrategy {
    return {
        nome: 'espia',
        descricao: 'registra a chamada',
        recomendar: (projeto, profissionais) => {
            chamadas.push('recomendar');
            return new SimilaridadeCosseno().recomendar(projeto, profissionais);
        }
    };
}

describe('Template Method: fluxo principal invariável', () => {
    it('chama as etapas sempre na mesma ordem', () => {
        const orquestrador = new OrquestradorEspiao();
        const projeto = criarProjeto();
        orquestrador.orquestrar(projeto, [criarProfissional()], estrategiaEspia(orquestrador.chamadas));
        orquestrador.orquestrar(projeto, [], estrategiaEspia(orquestrador.chamadas));

        const esperado = ['validarRestricoes', 'normalizarDados', 'recomendar', 'posProcessar'];
        expect(orquestrador.chamadas).toEqual([...esperado, ...esperado]);
    });

    it('interrompe o fluxo antes de recomendar quando a validação falha', () => {
        const orquestrador = new OrquestradorEspiao();
        orquestrador.problemas = ['orçamento inválido'];
        expect(() => orquestrador.orquestrar(criarProjeto(), [], estrategiaEspia(orquestrador.chamadas))).toThrow(
            RestricaoInvalidaError
        );
        expect(orquestrador.chamadas).toEqual(['validarRestricoes']);
    });

    it('impede que uma subclasse sobrescreva o método template', () => {
        class OrquestradorRebelde extends OrquestradorPadrao {
            override orquestrar(): never {
                throw new Error('fluxo alterado');
            }
        }
        expect(() => new OrquestradorRebelde()).toThrow(/não pode sobrescrever orquestrar/);
    });
});

describe('OrquestradorPadrao', () => {
    const relogio = () => HOJE;
    const estrategia = new SimilaridadeCosseno();

    it('valida prazo e orçamento', () => {
        const orquestrador = new OrquestradorPadrao({ relogio });
        const atrasado = criarProjeto({ prazo: new Date('2026-12-01') });
        expect(() => orquestrador.orquestrar(atrasado, [], estrategia)).toThrow(/data de entrega precisa ser futura/);

        const semVerba = criarProjeto({ orcamento: 1.5, papeis: [[Papel.DIRETOR, 1], [Papel.EDITOR, 1]] });
        expect(() => orquestrador.orquestrar(semVerba, [], estrategia)).toThrow(/orçamento insuficiente/);
    });

    it('recusa projeto com equipe já formada', () => {
        const projeto = criarProjeto();
        const diretor = criarProfissional({ id: 'd' });
        projeto.aceitarRecomendacao(Papel.DIRETOR, diretor);
        projeto.getEquipe()!.confirmarMembro(Papel.DIRETOR, 'd');
        projeto.getEquipe()!.formar(projeto.getPapeis());
        expect(() => new OrquestradorPadrao({ relogio }).orquestrar(projeto, [], estrategia)).toThrow(/já foi formada/);
    });

    it('normaliza: remove duplicados, indisponíveis, sem especialidade e caros demais', () => {
        const ok = criarProfissional({ id: 'ok', preco: 10_000 });
        const indisponivel = criarProfissional({ id: 'fora', disponivelAte: new Date('2027-03-01') });
        const caro = criarProfissional({ id: 'caro', preco: 500_000 });
        const editor = criarProfissional({ id: 'editor', especialidades: [Papel.EDITOR] });
        const resultado = new OrquestradorPadrao({ relogio }).orquestrar(
            criarProjeto({ orcamento: 100_000 }),
            [ok, ok, indisponivel, caro, editor],
            estrategia
        );
        expect(resultado.ranking.get(Papel.DIRETOR)?.map((c) => c.profissional.getId())).toEqual(['ok']);
    });

    it('pós-processa descartando candidatos com pontuação zero e informa papéis sem candidatos', () => {
        const semAderencia = criarProfissional({ id: 'zero', competencias: { culinaria: 9 } });
        const projeto = criarProjeto({ papeis: [[Papel.DIRETOR, 2], [Papel.SONOPLASTA, 1]] });
        const resultado = new OrquestradorPadrao({ relogio }).orquestrar(projeto, [semAderencia], estrategia);
        expect(resultado.ranking.get(Papel.DIRETOR)).toEqual([]);
        expect(resultado.papeisSemCandidatos).toEqual([Papel.DIRETOR, Papel.SONOPLASTA]);
        expect(resultado.sugestoes).toEqual([]);
    });

    it('monta várias sugestões distintas e sem repetir profissional entre papéis', () => {
        const projeto = criarProjeto({ papeis: [[Papel.DIRETOR, 3], [Papel.EDITOR, 1]], orcamento: 1_000_000 });
        const coringa = criarProfissional({
            id: 'coringa',
            especialidades: [Papel.DIRETOR, Papel.EDITOR],
            competencias: { direcao: 10, montagem: 10, roteiro: 6, colorizacao: 7 }
        });
        const diretores = [1, 2, 3].map((i) => criarProfissional({ id: `d${i}`, competencias: { direcao: 10 - i } }));
        const editores = [1, 2, 3].map((i) =>
            criarProfissional({ id: `e${i}`, especialidades: [Papel.EDITOR], competencias: { montagem: 10 - i } })
        );
        const { sugestoes } = new OrquestradorPadrao({ relogio, quantidadeSugestoes: 3 }).orquestrar(
            projeto,
            [coringa, ...diretores, ...editores],
            estrategia
        );

        expect(sugestoes).toHaveLength(3);
        const composicoes = sugestoes.map((e) => e.getMembros().map((m) => m.getProfissional().getId()).join(','));
        expect(new Set(composicoes).size).toBe(3);
        for (const equipe of sugestoes) {
            const ids = equipe.getMembros().map((m) => m.getProfissional().getId());
            expect(new Set(ids).size).toBe(ids.length);
            expect(equipe.estaCompleta(projeto.getPapeis())).toBe(true);
        }
    });

    it('troca membros de menor peso por opções mais baratas para caber no orçamento', () => {
        const projeto = criarProjeto({ papeis: [[Papel.DIRETOR, 3], [Papel.EDITOR, 1]], orcamento: 40_000 });
        const diretor = criarProfissional({ id: 'dir', preco: 30_000, competencias: { direcao: 10 } });
        const editorCaro = criarProfissional({
            id: 'editor-caro',
            especialidades: [Papel.EDITOR],
            preco: 20_000,
            competencias: { montagem: 10, colorizacao: 7 }
        });
        const editorBarato = criarProfissional({
            id: 'editor-barato',
            especialidades: [Papel.EDITOR],
            preco: 8_000,
            competencias: { montagem: 6 }
        });
        const { sugestoes } = new OrquestradorPadrao({ relogio, quantidadeSugestoes: 1 }).orquestrar(
            projeto,
            [diretor, editorCaro, editorBarato],
            estrategia
        );
        const equipe = sugestoes[0]!;
        expect(equipe.obterMembro(Papel.DIRETOR)?.getProfissional().getId()).toBe('dir');
        expect(equipe.obterMembro(Papel.EDITOR)?.getProfissional().getId()).toBe('editor-barato');
        expect(equipe.custoTotal()).toBeLessThanOrEqual(40_000);
    });

    it('nova rodada de um papel: mantém fixos e ignora excluídos', () => {
        const projeto = criarProjeto({ papeis: [[Papel.DIRETOR, 3], [Papel.EDITOR, 1]] });
        const diretorFixo = criarProfissional({ id: 'fixo' });
        const rejeitado = criarProfissional({ id: 'rejeitado', especialidades: [Papel.EDITOR], competencias: { montagem: 10 } });
        const alternativo = criarProfissional({ id: 'alt', especialidades: [Papel.EDITOR], competencias: { montagem: 5 } });

        const resultado = new OrquestradorPadrao({ relogio }).orquestrar(
            projeto,
            [diretorFixo, rejeitado, alternativo],
            estrategia,
            { papeis: [Papel.EDITOR], excluidos: ['rejeitado'], fixos: new Map([[Papel.DIRETOR, diretorFixo]]) }
        );
        expect([...resultado.ranking.keys()]).toEqual([Papel.EDITOR]);
        const equipe = resultado.sugestoes[0]!;
        expect(equipe.obterMembro(Papel.DIRETOR)?.getProfissional()).toBe(diretorFixo);
        expect(equipe.obterMembro(Papel.EDITOR)?.getProfissional().getId()).toBe('alt');
    });

    it('usa o relógio real e 3 sugestões por padrão', () => {
        const projeto = criarProjeto({ prazo: new Date(Date.now() + 90 * 86_400_000) });
        const profissional = criarProfissional({ disponivelAte: new Date(Date.now() + 400 * 86_400_000) });
        const resultado = new OrquestradorPadrao().orquestrar(projeto, [profissional], estrategia);
        expect(resultado.sugestoes).toHaveLength(1);
    });
});
