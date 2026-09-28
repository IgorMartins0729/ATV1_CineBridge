import { describe, expect, it } from 'vitest';
import { Convite } from '../../src/domain/entities/Convite.js';
import { Recomendacao } from '../../src/domain/entities/Recomendacao.js';
import { Papel } from '../../src/domain/enums/Papel.js';
import { StatusConvite } from '../../src/domain/enums/StatusConvite.js';
import { criarRepositoriosPrisma } from '../../src/infrastructure/repositories/prisma/index.js';
import { criarProfissional, criarProjeto } from '../fixtures/fabricas.js';

/**
 * Precisa de um PostgreSQL com as migrations aplicadas (npx prisma migrate dev).
 * Rode com: TESTAR_PRISMA=1 npm test   (no PowerShell: $env:TESTAR_PRISMA=1; npm test)
 */
describe.skipIf(!process.env['TESTAR_PRISMA'])('Repositórios Prisma (PostgreSQL real)', () => {
    it('salva e recupera profissional, projeto com equipe, convite e recomendação', async () => {
        const { repositorios, encerrar } = await criarRepositoriosPrisma();
        try {
            const sufixo = Date.now().toString(36);
            const diretor = criarProfissional({ id: `it-d-${sufixo}`, competencias: { direcao: 9 } });
            const editor = criarProfissional({ id: `it-e-${sufixo}`, especialidades: [Papel.EDITOR] });
            await repositorios.profissionais.salvar(diretor);
            await repositorios.profissionais.salvar(editor);

            expect((await repositorios.profissionais.buscarPorId(diretor.getId()))?.nivelEm('direcao')).toBe(9);
            const candidatos = await repositorios.profissionais.buscarCandidatos({
                papeis: [Papel.EDITOR],
                disponivelEm: new Date('2027-06-01'),
                excluirIds: [diretor.getId()]
            });
            expect(candidatos.map((p) => p.getId())).toContain(editor.getId());

            const projeto = criarProjeto({ id: `it-p-${sufixo}`, papeis: [[Papel.DIRETOR, 2], [Papel.EDITOR, 1]] });
            projeto.aceitarRecomendacao(Papel.DIRETOR, diretor);
            projeto.aceitarRecomendacao(Papel.EDITOR, editor);
            await repositorios.projetos.salvar(projeto);
            const lido = await repositorios.projetos.buscarPorId(projeto.getId());
            expect(lido?.getEquipe()?.obterMembro(Papel.EDITOR)?.getProfissional().getId()).toBe(editor.getId());

            const convite = new Convite({ projetoId: projeto.getId(), papel: Papel.EDITOR, profissional: editor });
            await repositorios.convites.salvar(convite);
            convite.aceitar();
            await repositorios.convites.salvar(convite);
            expect((await repositorios.convites.buscarPorId(convite.getId()))?.getStatus()).toBe(StatusConvite.ACEITO);
            expect(await repositorios.convites.listarPorProjeto(projeto.getId())).toHaveLength(1);

            await repositorios.recomendacoes.salvar(
                new Recomendacao({
                    projetoId: projeto.getId(),
                    estrategia: 'similaridade-cosseno',
                    ranking: new Map([[Papel.DIRETOR, [{ profissional: diretor, pontuacao: 0.9 }]]]),
                    parcial: false
                })
            );
            const [recomendacao] = await repositorios.recomendacoes.listarPorProjeto(projeto.getId());
            expect(recomendacao?.melhorCandidato(Papel.DIRETOR)?.profissional.getId()).toBe(diretor.getId());
        } finally {
            await encerrar();
        }
    });
});
