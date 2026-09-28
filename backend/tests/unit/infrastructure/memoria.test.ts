import { describe, expect, it } from 'vitest';
import { Convite } from '../../../src/domain/entities/Convite.js';
import { Recomendacao } from '../../../src/domain/entities/Recomendacao.js';
import { Papel } from '../../../src/domain/enums/Papel.js';
import { gerarProfissionais } from '../../../src/infrastructure/dados/geradorProfissionais.js';
import { ConviteRepositoryMemoria } from '../../../src/infrastructure/repositories/memoria/ConviteRepositoryMemoria.js';
import { ProfissionalRepositoryMemoria } from '../../../src/infrastructure/repositories/memoria/ProfissionalRepositoryMemoria.js';
import { ProjetoRepositoryMemoria } from '../../../src/infrastructure/repositories/memoria/ProjetoRepositoryMemoria.js';
import { RecomendacaoRepositoryMemoria } from '../../../src/infrastructure/repositories/memoria/RecomendacaoRepositoryMemoria.js';
import { criarProfissional, criarProjeto } from '../../fixtures/fabricas.js';

describe('ProfissionalRepositoryMemoria', () => {
    const diretor = criarProfissional({ id: 'd', especialidades: [Papel.DIRETOR], preco: 30_000 });
    const editor = criarProfissional({ id: 'e', especialidades: [Papel.EDITOR], preco: 8_000 });
    const indisponivel = criarProfissional({
        id: 'i',
        especialidades: [Papel.EDITOR],
        disponivelAte: new Date('2026-06-01')
    });

    it('lista, busca por id, salva e conta', async () => {
        const repo = new ProfissionalRepositoryMemoria([diretor]);
        expect(await repo.contar()).toBe(1);
        await repo.salvar(editor);
        expect(await repo.listarTodos()).toHaveLength(2);
        expect(await repo.buscarPorId('e')).toBe(editor);
        expect(await repo.buscarPorId('x')).toBeNull();
    });

    it('filtra candidatos por papel, disponibilidade, preço e exclusões', async () => {
        const repo = new ProfissionalRepositoryMemoria([diretor, editor, indisponivel]);
        const data = new Date('2027-03-01');

        expect(await repo.buscarCandidatos({ papeis: [Papel.EDITOR] })).toEqual([editor, indisponivel]);
        expect(await repo.buscarCandidatos({ papeis: [Papel.EDITOR], disponivelEm: data })).toEqual([editor]);
        expect(await repo.buscarCandidatos({ papeis: [Papel.DIRETOR, Papel.EDITOR], precoMaximo: 10_000 })).toEqual([
            editor,
            indisponivel
        ]);
        expect(await repo.buscarCandidatos({ papeis: [Papel.EDITOR], excluirIds: ['e'] })).toEqual([indisponivel]);
    });
});

describe('Repositórios de projeto, convite e recomendação', () => {
    it('guardam e recuperam as entidades', async () => {
        const projetos = new ProjetoRepositoryMemoria();
        const projeto = criarProjeto({ id: 'p1' });
        await projetos.salvar(projeto);
        expect(await projetos.buscarPorId('p1')).toBe(projeto);
        expect(await projetos.buscarPorId('p2')).toBeNull();

        const convites = new ConviteRepositoryMemoria();
        const convite = new Convite({ projetoId: 'p1', papel: Papel.DIRETOR, profissional: criarProfissional() });
        await convites.salvar(convite);
        expect(await convites.buscarPorId(convite.getId())).toBe(convite);
        expect(await convites.buscarPorId('nada')).toBeNull();
        expect(await convites.listarPorProjeto('p1')).toEqual([convite]);
        expect(await convites.listarPorProjeto('p2')).toEqual([]);

        const recomendacoes = new RecomendacaoRepositoryMemoria();
        const recomendacao = new Recomendacao({ projetoId: 'p1', estrategia: 'x', ranking: new Map(), parcial: false });
        await recomendacoes.salvar(recomendacao);
        expect(await recomendacoes.listarPorProjeto('p1')).toEqual([recomendacao]);
    });
});

describe('gerarProfissionais', () => {
    it('é determinístico para a mesma semente e distribui os papéis', () => {
        const referencia = new Date('2027-01-01');
        const a = gerarProfissionais(60, { semente: 7, referencia });
        const b = gerarProfissionais(60, { semente: 7, referencia });
        expect(a.map((p) => p.getNome())).toEqual(b.map((p) => p.getNome()));
        expect(a.map((p) => p.getPrecoMedio())).toEqual(b.map((p) => p.getPrecoMedio()));

        for (const papel of Object.values(Papel)) {
            expect(a.filter((p) => p.possuiEspecialidade(papel)).length).toBeGreaterThanOrEqual(10);
        }
        expect(a.every((p) => p.estaDisponivelEm(referencia))).toBe(true);
        expect(new Set(a.map((p) => p.getId())).size).toBe(60);
    });

    it('usa semente e data atuais por padrão', () => {
        expect(gerarProfissionais(3)).toHaveLength(3);
    });
});
