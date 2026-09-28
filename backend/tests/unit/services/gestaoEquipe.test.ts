import { describe, expect, it } from 'vitest';
import { TipoEvento } from '../../../src/application/eventos/EventoRecomendacao.js';
import { Papel } from '../../../src/domain/enums/Papel.js';
import { StatusConvite } from '../../../src/domain/enums/StatusConvite.js';
import { StatusEquipe } from '../../../src/domain/enums/StatusEquipe.js';
import { TipoCaptacao } from '../../../src/domain/enums/TipoCaptacao.js';
import { ConflitoError, NaoEncontradoError, ValidacaoError } from '../../../src/domain/erros.js';
import { criarContainer } from '../../../src/config/container.js';
import { criarProfissional, HOJE, PRAZO_PADRAO } from '../../fixtures/fabricas.js';

function cenario(opcoes: { editores?: number } = {}) {
    const diretores = [1, 2, 3].map((i) =>
        criarProfissional({ id: `d${i}`, nome: `Diretor ${i}`, preco: 30_000, competencias: { direcao: 11 - i, roteiro: 6 } })
    );
    const editores = Array.from({ length: opcoes.editores ?? 3 }, (_, i) =>
        criarProfissional({
            id: `e${i + 1}`,
            nome: `Editor ${i + 1}`,
            especialidades: [Papel.EDITOR],
            preco: 10_000,
            competencias: { montagem: 10 - i, colorizacao: 7 }
        })
    );
    const container = criarContainer({ profissionais: [...diretores, ...editores], relogio: () => HOJE });
    const tipos: string[] = [];
    container.eventBus.assinar('*', (evento) => void tipos.push(evento.tipo));
    return { container, tipos };
}

async function criarProjeto(container: ReturnType<typeof cenario>['container'], orcamento = 100_000) {
    return container.projetoService.criar({
        titulo: 'Maré Alta',
        produtor: { id: 'prod-1', nome: 'Paula', email: 'paula@produtora.test' },
        genero: 'drama',
        duracao: 95,
        orcamento,
        prazo: PRAZO_PADRAO,
        tipoCaptacao: TipoCaptacao.FICCAO,
        localizacao: { cidade: 'São Paulo', uf: 'SP' },
        papeisObrigatorios: [
            { papel: Papel.DIRETOR, peso: 3 },
            { papel: Papel.EDITOR, peso: 1 }
        ]
    });
}

function membroId(projeto: { getEquipe(): { obterMembro(p: Papel): { getProfissional(): { getId(): string } } | null } | null }, papel: Papel) {
    return projeto.getEquipe()?.obterMembro(papel)?.getProfissional().getId();
}

describe('GestaoEquipeService: recomendação e composição', () => {
    it('recomenda a equipe e adota a melhor sugestão', async () => {
        const { container, tipos } = cenario();
        const projeto = await criarProjeto(container);
        const resultado = await container.gestaoEquipe.recomendarEquipe(projeto.getId());

        expect(resultado.sugestoes.length).toBeGreaterThan(1);
        expect(membroId(projeto, Papel.DIRETOR)).toBe('d1');
        expect(membroId(projeto, Papel.EDITOR)).toBe('e1');
        expect(projeto.getEquipe()?.getStatus()).toBe(StatusEquipe.EM_FORMACAO);
        expect(tipos).toEqual([TipoEvento.RECOMENDACAO_GERADA]);
        expect(await container.repositorios.recomendacoes.listarPorProjeto(projeto.getId())).toHaveLength(1);
        expect(container.canais.email.getEnviados().length).toBeGreaterThanOrEqual(2);
    });

    it('permite escolher a estratégia na hora e recusa nome inválido sem alterar o projeto', async () => {
        const { container } = cenario();
        const projeto = await criarProjeto(container);
        const resultado = await container.gestaoEquipe.recomendarEquipe(projeto.getId(), 'filtragem-colaborativa');
        expect(resultado.recomendacao.getEstrategia()).toBe('filtragem-colaborativa');

        await expect(container.gestaoEquipe.recomendarEquipe(projeto.getId(), 'nao-existe')).rejects.toThrow(
            ValidacaoError
        );
        expect(projeto.getEstrategia()).toBe('filtragem-colaborativa');
    });

    it('fluxo completo: convites aceitos formam a equipe e disparam eventos para outros microsserviços', async () => {
        const { container, tipos } = cenario();
        const projeto = await criarProjeto(container);
        await container.gestaoEquipe.recomendarEquipe(projeto.getId());

        const conviteDiretor = await container.gestaoEquipe.aceitarMembro(projeto.getId(), Papel.DIRETOR);
        const conviteEditor = await container.gestaoEquipe.aceitarMembro(projeto.getId(), Papel.EDITOR);
        await container.conviteService.responder(conviteDiretor.getId(), true);
        expect(projeto.getEquipe()?.getStatus()).toBe(StatusEquipe.EM_FORMACAO);
        await container.conviteService.responder(conviteEditor.getId(), true);

        expect(projeto.getEquipe()?.getStatus()).toBe(StatusEquipe.FORMADA);
        expect(projeto.getEquipe()?.getDataFormacao()).toBeInstanceOf(Date);
        expect(tipos.filter((t) => t === TipoEvento.EQUIPE_FORMADA)).toHaveLength(1);
        expect(container.integracoes.financeiro.getEnviados()).toHaveLength(1);
        expect(container.integracoes.gerenciamentoProjetos.getEnviados()).toHaveLength(1);
        const paraProdutor = container.canais.email.getEnviados().filter((m) => m.para === 'paula@produtora.test');
        expect(paraProdutor.map((m) => m.assunto)).toContain('Diretor 1 aceitou o convite');
        expect(await container.canais.mensagens.listar('prod-1')).not.toHaveLength(0);

        await expect(container.gestaoEquipe.recomendarEquipe(projeto.getId())).rejects.toThrow(ConflitoError);
        await expect(container.conviteService.responder(conviteEditor.getId(), false)).rejects.toThrow(ConflitoError);
    });

    it('aceitar o mesmo membro duas vezes reaproveita o convite pendente', async () => {
        const { container } = cenario();
        const projeto = await criarProjeto(container);
        await container.gestaoEquipe.recomendarEquipe(projeto.getId());
        const a = await container.gestaoEquipe.aceitarMembro(projeto.getId(), Papel.EDITOR);
        const b = await container.gestaoEquipe.aceitarMembro(projeto.getId(), Papel.EDITOR);
        expect(b).toBe(a);
        expect(await container.gestaoEquipe.listarConvites(projeto.getId())).toHaveLength(1);
    });

    it('não aceita papel vazio nem membro já confirmado', async () => {
        const { container } = cenario();
        const projeto = await criarProjeto(container);
        await expect(container.gestaoEquipe.aceitarMembro(projeto.getId(), Papel.DIRETOR)).rejects.toThrow(
            NaoEncontradoError
        );
        await container.gestaoEquipe.recomendarEquipe(projeto.getId());
        const convite = await container.gestaoEquipe.aceitarMembro(projeto.getId(), Papel.DIRETOR);
        await container.conviteService.responder(convite.getId(), true);
        await expect(container.gestaoEquipe.aceitarMembro(projeto.getId(), Papel.DIRETOR)).rejects.toThrow(
            ConflitoError
        );
    });
});

describe('GestaoEquipeService: rejeição e substituição (nova rodada só do papel afetado)', () => {
    it('rejeitar troca apenas o papel afetado e o rejeitado não volta a ser recomendado', async () => {
        const { container, tipos } = cenario();
        const projeto = await criarProjeto(container);
        await container.gestaoEquipe.recomendarEquipe(projeto.getId());

        const resultado = await container.gestaoEquipe.rejeitarMembro(projeto.getId(), Papel.EDITOR);
        expect(membroId(projeto, Papel.DIRETOR)).toBe('d1');
        expect(resultado.membro?.getId()).toBe('e2');
        expect(resultado.alternativas.map((c) => c.profissional.getId())).not.toContain('e1');
        expect(projeto.getProfissionaisRejeitados().has('e1')).toBe(true);
        expect(tipos.slice(-2)).toEqual([TipoEvento.RECOMENDACAO_GERADA, TipoEvento.MEMBRO_SUBSTITUIDO]);

        await container.gestaoEquipe.recomendarEquipe(projeto.getId());
        expect(membroId(projeto, Papel.EDITOR)).not.toBe('e1');
    });

    it('substituir por um candidato específico e validar a escolha', async () => {
        const { container } = cenario();
        const projeto = await criarProjeto(container);
        await container.gestaoEquipe.recomendarEquipe(projeto.getId());

        const resultado = await container.gestaoEquipe.substituirMembro(projeto.getId(), Papel.EDITOR, 'e3');
        expect(resultado.membro?.getId()).toBe('e3');
        expect(membroId(projeto, Papel.DIRETOR)).toBe('d1');

        await expect(container.gestaoEquipe.substituirMembro(projeto.getId(), Papel.EDITOR, 'd2')).rejects.toThrow(
            ValidacaoError
        );
        await expect(container.gestaoEquipe.substituirMembro(projeto.getId(), Papel.SONOPLASTA)).rejects.toThrow(
            ValidacaoError
        );
    });

    it('rejeitar cancela o convite pendente do papel', async () => {
        const { container } = cenario();
        const projeto = await criarProjeto(container);
        await container.gestaoEquipe.recomendarEquipe(projeto.getId());
        const convite = await container.gestaoEquipe.aceitarMembro(projeto.getId(), Papel.EDITOR);
        await container.gestaoEquipe.rejeitarMembro(projeto.getId(), Papel.EDITOR);
        expect(convite.getStatus()).toBe(StatusConvite.CANCELADO);
    });

    it('papel sem mais candidatos fica vago e o resultado é parcial', async () => {
        const { container } = cenario({ editores: 1 });
        const projeto = await criarProjeto(container);
        await container.gestaoEquipe.recomendarEquipe(projeto.getId());
        const resultado = await container.gestaoEquipe.rejeitarMembro(projeto.getId(), Papel.EDITOR);
        expect(resultado.membro).toBeNull();
        expect(resultado.parcial).toBe(true);
        expect(projeto.getEquipe()?.obterMembro(Papel.EDITOR)).toBeNull();
    });

    it('recusa de convite dispara nova recomendação para o papel', async () => {
        const { container, tipos } = cenario();
        const projeto = await criarProjeto(container);
        await container.gestaoEquipe.recomendarEquipe(projeto.getId());
        const convite = await container.gestaoEquipe.aceitarMembro(projeto.getId(), Papel.EDITOR);

        await container.conviteService.responder(convite.getId(), false);
        expect(convite.getStatus()).toBe(StatusConvite.RECUSADO);
        expect(membroId(projeto, Papel.EDITOR)).toBe('e2');
        expect(tipos).toContain(TipoEvento.CONVITE_RECUSADO);
        expect(tipos.at(-1)).toBe(TipoEvento.MEMBRO_SUBSTITUIDO);
    });

    it('ignora respostas de convite que já não correspondem à equipe', async () => {
        const { container } = cenario();
        const projeto = await criarProjeto(container);
        await container.gestaoEquipe.confirmarPresenca(projeto.getId(), Papel.EDITOR, 'e1');
        await container.gestaoEquipe.recomendarEquipe(projeto.getId());
        await container.gestaoEquipe.tratarRecusa(projeto.getId(), Papel.EDITOR, 'outro');
        expect(membroId(projeto, Papel.EDITOR)).toBe('e1');
    });
});

describe('GestaoEquipeService: reavaliação por mudança de orçamento/prazo', () => {
    it('mudança pequena mantém a equipe; mudança grande reavalia tudo', async () => {
        const { container, tipos } = cenario();
        const projeto = await criarProjeto(container);
        await container.gestaoEquipe.recomendarEquipe(projeto.getId());
        const equipeOriginal = projeto.getEquipe();

        const pequena = await container.gestaoEquipe.atualizarRestricoes(projeto.getId(), { orcamento: 105_000 });
        expect(pequena.reavaliado).toBe(false);
        expect(projeto.getEquipe()).toBe(equipeOriginal);

        const grande = await container.gestaoEquipe.atualizarRestricoes(projeto.getId(), { orcamento: 45_000 });
        expect(grande.reavaliado).toBe(true);
        expect(grande.resultado?.recomendacao.getEstrategia()).toBe('regras-orcamento');
        expect(projeto.getEquipe()).not.toBe(equipeOriginal);
        expect(tipos).toContain(TipoEvento.REAVALIACAO_SOLICITADA);
    });

    it('reavalia quando o prazo muda muito ou quando o produtor força', async () => {
        const { container } = cenario();
        const projeto = await criarProjeto(container);
        const porPrazo = await container.gestaoEquipe.atualizarRestricoes(projeto.getId(), {
            prazo: new Date('2027-09-30')
        });
        expect(porPrazo.reavaliado).toBe(true);

        const forcada = await container.gestaoEquipe.atualizarRestricoes(projeto.getId(), { forcarReavaliacao: true });
        expect(forcada.reavaliado).toBe(true);
    });
});

describe('ProjetoService e ConviteService', () => {
    it('valida estratégia na criação e busca inexistente', async () => {
        const { container } = cenario();
        await expect(
            container.projetoService.criar({
                titulo: 'X',
                produtor: { id: 'p', nome: 'P', email: 'p@p' },
                genero: 'drama',
                duracao: 10,
                orcamento: 10,
                prazo: PRAZO_PADRAO,
                tipoCaptacao: TipoCaptacao.ANIMACAO,
                localizacao: { cidade: 'Recife', uf: 'PE' },
                papeisObrigatorios: [{ papel: Papel.EDITOR, peso: 1 }],
                estrategia: 'magica'
            })
        ).rejects.toThrow(ValidacaoError);
        await expect(container.projetoService.buscar('nada')).rejects.toThrow(NaoEncontradoError);
        await expect(container.gestaoEquipe.buscarProjeto('nada')).rejects.toThrow(NaoEncontradoError);
        await expect(container.conviteService.responder('nada', true)).rejects.toThrow(NaoEncontradoError);
    });

    it('guarda a estratégia escolhida na criação', async () => {
        const { container } = cenario();
        const projeto = await container.projetoService.criar({
            titulo: 'Doc',
            produtor: { id: 'p', nome: 'P', email: 'p@p' },
            genero: 'biografia',
            duracao: 60,
            orcamento: 200_000,
            prazo: PRAZO_PADRAO,
            tipoCaptacao: TipoCaptacao.DOCUMENTARIO,
            localizacao: { cidade: 'Recife', uf: 'PE' },
            papeisObrigatorios: [{ papel: Papel.EDITOR, peso: 1 }],
            estrategia: 'filtragem-colaborativa'
        });
        expect(projeto.getEstrategia()).toBe('filtragem-colaborativa');
        expect(await container.projetoService.buscar(projeto.getId())).toBe(projeto);
    });

    it('responder convite de projeto removido gera NaoEncontrado', async () => {
        const { container } = cenario();
        const projeto = await criarProjeto(container);
        await container.gestaoEquipe.recomendarEquipe(projeto.getId());
        const convite = await container.gestaoEquipe.aceitarMembro(projeto.getId(), Papel.EDITOR);
        container.repositorios.projetos.buscarPorId = async () => null;
        await expect(container.conviteService.responder(convite.getId(), true)).rejects.toThrow(NaoEncontradoError);
    });
});
