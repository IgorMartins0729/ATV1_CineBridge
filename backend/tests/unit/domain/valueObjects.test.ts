import { describe, expect, it } from 'vitest';
import { Avaliacao } from '../../../src/domain/entities/Avaliacao.js';
import { Competencia } from '../../../src/domain/entities/Competencia.js';
import { Papel } from '../../../src/domain/enums/Papel.js';
import { RestricaoInvalidaError, ValidacaoError } from '../../../src/domain/erros.js';
import { FaixaPreco } from '../../../src/domain/value-objects/FaixaPreco.js';
import { Intervalo } from '../../../src/domain/value-objects/Intervalo.js';
import { Localizacao } from '../../../src/domain/value-objects/Localizacao.js';
import { RequisitoPapel } from '../../../src/domain/value-objects/RequisitoPapel.js';

describe('Value objects e entidades simples', () => {
    it('Intervalo valida datas e verifica se contém uma data', () => {
        const intervalo = new Intervalo(new Date('2027-01-01'), new Date('2027-12-31'));
        expect(intervalo.contem(new Date('2027-06-01'))).toBe(true);
        expect(intervalo.contem(new Date('2028-01-01'))).toBe(false);
        expect(intervalo.getInicio()).toEqual(new Date('2027-01-01'));
        expect(intervalo.getFim()).toEqual(new Date('2027-12-31'));
        expect(() => new Intervalo(new Date('2027-02-01'), new Date('2027-01-01'))).toThrow(ValidacaoError);
        expect(() => new Intervalo(new Date('invalida'), new Date())).toThrow(ValidacaoError);
    });

    it('Intervalo não expõe a data interna para alteração', () => {
        const intervalo = new Intervalo(new Date('2027-01-01'), new Date('2027-12-31'));
        intervalo.getInicio().setUTCFullYear(1990);
        expect(intervalo.getInicio().getUTCFullYear()).toBe(2027);
    });

    it('Localizacao normaliza UF e compara cidade/estado', () => {
        const sp = new Localizacao(' São Paulo ', 'sp');
        expect(sp.getUf()).toBe('SP');
        expect(sp.getCidade()).toBe('São Paulo');
        expect(sp.toString()).toBe('São Paulo/SP');
        expect(sp.mesmaCidade(new Localizacao('são paulo', 'SP'))).toBe(true);
        expect(sp.mesmoEstado(new Localizacao('Campinas', 'SP'))).toBe(true);
        expect(sp.mesmaCidade(new Localizacao('Campinas', 'SP'))).toBe(false);
        expect(() => new Localizacao('', 'SP')).toThrow(ValidacaoError);
        expect(() => new Localizacao('Rio', 'RJX')).toThrow(ValidacaoError);
    });

    it('FaixaPreco calcula média e valida limites', () => {
        const faixa = new FaixaPreco(1000, 3000);
        expect(faixa.getMedia()).toBe(2000);
        expect(faixa.getMinimo()).toBe(1000);
        expect(faixa.getMaximo()).toBe(3000);
        expect(() => new FaixaPreco(-1, 10)).toThrow(ValidacaoError);
        expect(() => new FaixaPreco(10, 5)).toThrow(ValidacaoError);
    });

    it('RequisitoPapel exige peso positivo', () => {
        const requisito = new RequisitoPapel(Papel.EDITOR, 2);
        expect(requisito.getPapel()).toBe(Papel.EDITOR);
        expect(requisito.getPeso()).toBe(2);
        expect(() => new RequisitoPapel(Papel.EDITOR, 0)).toThrow(ValidacaoError);
    });

    it('Competencia e Avaliacao validam faixas', () => {
        expect(() => new Competencia('audio', 11)).toThrow(ValidacaoError);
        expect(() => new Competencia('  ', 5)).toThrow(ValidacaoError);
        expect(() => new Avaliacao(6, 'x', new Date())).toThrow(ValidacaoError);
        expect(() => new Avaliacao(3, 'x', new Date('nada'))).toThrow(ValidacaoError);
        const avaliacao = new Avaliacao(4.5, 'Excelente', new Date('2026-01-01'));
        expect(avaliacao.getNota()).toBe(4.5);
        expect(avaliacao.getComentario()).toBe('Excelente');
        expect(avaliacao.getData()).toEqual(new Date('2026-01-01'));
    });

    it('RestricaoInvalidaError guarda a lista de problemas', () => {
        const erro = new RestricaoInvalidaError(['a', 'b']);
        expect(erro.getProblemas()).toEqual(['a', 'b']);
        expect(erro.codigo).toBe('RESTRICAO_INVALIDA');
        expect(erro.name).toBe('RestricaoInvalidaError');
        expect(erro.message).toContain('a; b');
    });
});
