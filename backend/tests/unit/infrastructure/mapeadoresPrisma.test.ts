import { describe, expect, it } from 'vitest';
import { Papel } from '../../../src/domain/enums/Papel.js';
import { TipoCaptacao } from '../../../src/domain/enums/TipoCaptacao.js';
import {
    dadosFilhosProfissional,
    dadosProfissional,
    paraProfissional,
    type ProfissionalCompleto
} from '../../../src/infrastructure/repositories/prisma/mapeadores.js';
import { criarProfissional } from '../../fixtures/fabricas.js';

describe('Mapeadores Prisma <-> domínio', () => {
    it('converte o profissional para linhas do banco e de volta sem perder dados', () => {
        const original = criarProfissional({
            id: 'p-map',
            especialidades: [Papel.EDITOR, Papel.SONOPLASTA],
            competencias: { montagem: 9, audio: 6 },
            notas: [4, 5],
            preco: 12_000,
            cidade: 'Curitiba',
            uf: 'PR',
            historico: [{ titulo: 'Doc', genero: 'biografia', tipoCaptacao: TipoCaptacao.DOCUMENTARIO, ano: 2025 }]
        });

        const linha = dadosProfissional(original);
        expect(linha.precoMedio).toBeCloseTo(12_000);
        expect(linha.especialidades).toEqual(['EDITOR', 'SONOPLASTA']);

        const filhos = dadosFilhosProfissional(original);
        expect(filhos.competencias).toHaveLength(2);
        expect(filhos.avaliacoes.map((a) => a.nota)).toEqual([4, 5]);
        expect(filhos.historico[0]?.tipoCaptacao).toBe('DOCUMENTARIO');

        let id = 0;
        const completo = {
            ...linha,
            especialidades: linha.especialidades,
            competencias: filhos.competencias.map((c) => ({ ...c, id: ++id })),
            avaliacoes: filhos.avaliacoes.map((a) => ({ ...a, id: ++id })),
            historico: filhos.historico.map((h) => ({ ...h, id: ++id }))
        } as unknown as ProfissionalCompleto;
        const volta = paraProfissional(completo);

        expect(volta.getId()).toBe('p-map');
        expect(volta.getEspecialidades()).toEqual([Papel.EDITOR, Papel.SONOPLASTA]);
        expect(volta.nivelEm('montagem')).toBe(9);
        expect(volta.mediaAvaliacoes()).toBe(4.5);
        expect(volta.getHistoricoProjetos()).toEqual(original.getHistoricoProjetos());
        expect(volta.getLocalizacao().toString()).toBe('Curitiba/PR');
        expect(volta.getPrecoMedio()).toBeCloseTo(original.getPrecoMedio());
    });
});
