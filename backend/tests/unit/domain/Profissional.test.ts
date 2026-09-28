import { describe, expect, it } from 'vitest';
import { Profissional } from '../../../src/domain/entities/Profissional.js';
import { Papel } from '../../../src/domain/enums/Papel.js';
import { TipoCaptacao } from '../../../src/domain/enums/TipoCaptacao.js';
import { ValidacaoError } from '../../../src/domain/erros.js';
import { FaixaPreco } from '../../../src/domain/value-objects/FaixaPreco.js';
import { Intervalo } from '../../../src/domain/value-objects/Intervalo.js';
import { Localizacao } from '../../../src/domain/value-objects/Localizacao.js';
import { criarProfissional } from '../../fixtures/fabricas.js';

describe('Profissional', () => {
    it('calcula média de avaliações, nível médio e vetor de competências', () => {
        const profissional = criarProfissional({
            competencias: { direcao: 8, Roteiro: 6 },
            notas: [5, 4, 3]
        });
        expect(profissional.mediaAvaliacoes()).toBe(4);
        expect(profissional.nivelMedioCompetencias()).toBe(7);
        expect(profissional.nivelEm('roteiro')).toBe(6);
        expect(profissional.vetorCompetencias(['direcao', 'audio', 'roteiro'])).toEqual([8, 0, 6]);
    });

    it('retorna zero quando não há avaliações nem competências', () => {
        const profissional = criarProfissional({ notas: [], competencias: {} });
        expect(profissional.mediaAvaliacoes()).toBe(0);
        expect(profissional.nivelMedioCompetencias()).toBe(0);
    });

    it('verifica especialidade, disponibilidade e preço médio', () => {
        const profissional = criarProfissional({
            especialidades: [Papel.EDITOR, Papel.EDITOR, Papel.SONOPLASTA],
            preco: 10_000,
            disponivelDe: new Date('2027-01-01'),
            disponivelAte: new Date('2027-03-01')
        });
        expect(profissional.getEspecialidades()).toEqual([Papel.EDITOR, Papel.SONOPLASTA]);
        expect(profissional.possuiEspecialidade(Papel.EDITOR)).toBe(true);
        expect(profissional.possuiEspecialidade(Papel.DIRETOR)).toBe(false);
        expect(profissional.estaDisponivelEm(new Date('2027-02-01'))).toBe(true);
        expect(profissional.estaDisponivelEm(new Date('2027-04-01'))).toBe(false);
        expect(profissional.getPrecoMedio()).toBeCloseTo(10_000);
    });

    it('expõe dados de cadastro', () => {
        const historico = [{ titulo: 'Doc', genero: 'drama', tipoCaptacao: TipoCaptacao.DOCUMENTARIO, ano: 2024 }];
        const profissional = criarProfissional({ id: 'p-x', nome: 'Bia', historico, cidade: 'Recife', uf: 'PE' });
        expect(profissional.getId()).toBe('p-x');
        expect(profissional.getNome()).toBe('Bia');
        expect(profissional.getEmail()).toBe('p-x@cinebridge.test');
        expect(profissional.getHistoricoProjetos()).toEqual(historico);
        expect(profissional.getLocalizacao().toString()).toBe('Recife/PE');
        expect(profissional.getAvaliacoes()).toHaveLength(1);
        expect(profissional.getCompetencias()).toHaveLength(1);
        expect(profissional.getFaixaPreco().getMaximo()).toBeCloseTo(11_000);
        expect(profissional.getDisponibilidade().getFim()).toEqual(new Date('2028-01-01'));
    });

    it('rejeita cadastro sem id, nome ou especialidade', () => {
        const base = {
            id: 'x',
            nome: 'Nome',
            email: 'x@x.com',
            especialidades: [Papel.EDITOR],
            competencias: [],
            faixaPreco: new FaixaPreco(1, 2),
            disponibilidade: new Intervalo(new Date('2027-01-01'), new Date('2027-02-01')),
            localizacao: new Localizacao('Rio de Janeiro', 'RJ')
        };
        expect(() => new Profissional({ ...base, id: ' ' })).toThrow(ValidacaoError);
        expect(() => new Profissional({ ...base, nome: '' })).toThrow(ValidacaoError);
        expect(() => new Profissional({ ...base, especialidades: [] })).toThrow(ValidacaoError);
        expect(new Profissional(base).getAvaliacoes()).toEqual([]);
    });
});
