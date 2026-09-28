import { describe, expect, it } from 'vitest';
import { Equipe } from '../../../src/domain/entities/Equipe.js';
import { MembroEquipe } from '../../../src/domain/entities/MembroEquipe.js';
import { Projeto } from '../../../src/domain/entities/Projeto.js';
import { Papel } from '../../../src/domain/enums/Papel.js';
import { TipoCaptacao } from '../../../src/domain/enums/TipoCaptacao.js';
import { ConflitoError, ValidacaoError } from '../../../src/domain/erros.js';
import { Localizacao } from '../../../src/domain/value-objects/Localizacao.js';
import { RequisitoPapel } from '../../../src/domain/value-objects/RequisitoPapel.js';
import { criarProfissional, criarProjeto, PRAZO_PADRAO } from '../../fixtures/fabricas.js';

function propsValidas() {
    return {
        titulo: 'Filme',
        produtor: { id: 'p', nome: 'P', email: 'p@p.com' },
        genero: 'Drama',
        duracao: 100,
        orcamento: 50_000,
        prazo: PRAZO_PADRAO,
        tipoCaptacao: TipoCaptacao.FICCAO,
        localizacao: new Localizacao('Salvador', 'BA'),
        papeisObrigatorios: [new RequisitoPapel(Papel.DIRETOR, 3), new RequisitoPapel(Papel.EDITOR, 1)]
    };
}

describe('Projeto', () => {
    it('guarda os atributos do projeto e calcula pesos e verba por papel', () => {
        const projeto = new Projeto(propsValidas());
        expect(projeto.getId()).toMatch(/[0-9a-f-]{36}/);
        expect(projeto.getGenero()).toBe('drama');
        expect(projeto.getTitulo()).toBe('Filme');
        expect(projeto.getDuracao()).toBe(100);
        expect(projeto.getTipoCaptacao()).toBe(TipoCaptacao.FICCAO);
        expect(projeto.getLocalizacao().getUf()).toBe('BA');
        expect(projeto.getProdutor().email).toBe('p@p.com');
        expect(projeto.getPapeis()).toEqual([Papel.DIRETOR, Papel.EDITOR]);
        expect(projeto.getPapeisObrigatorios()).toHaveLength(2);
        expect(projeto.somaPesos()).toBe(4);
        expect(projeto.pesoDoPapel(Papel.DIRETOR)).toBe(3);
        expect(projeto.pesoDoPapel(Papel.SONOPLASTA)).toBe(0);
        expect(projeto.verbaDoPapel(Papel.DIRETOR)).toBe(37_500);
        expect(projeto.exigePapel(Papel.EDITOR)).toBe(true);
        expect(projeto.getEquipe()).toBeNull();
        expect(projeto.getEstrategia()).toBeNull();
    });

    it('valida dados obrigatórios', () => {
        expect(() => new Projeto({ ...propsValidas(), titulo: ' ' })).toThrow(ValidacaoError);
        expect(() => new Projeto({ ...propsValidas(), duracao: 0 })).toThrow(ValidacaoError);
        expect(() => new Projeto({ ...propsValidas(), orcamento: -5 })).toThrow(ValidacaoError);
        expect(() => new Projeto({ ...propsValidas(), prazo: new Date('x') })).toThrow(ValidacaoError);
        expect(() => new Projeto({ ...propsValidas(), papeisObrigatorios: [] })).toThrow(ValidacaoError);
        expect(
            () =>
                new Projeto({
                    ...propsValidas(),
                    papeisObrigatorios: [new RequisitoPapel(Papel.EDITOR, 1), new RequisitoPapel(Papel.EDITOR, 2)]
                })
        ).toThrow(ValidacaoError);
    });

    it('aceita, substitui e rejeita membros', () => {
        const projeto = criarProjeto({ papeis: [[Papel.DIRETOR, 3], [Papel.EDITOR, 1]] });
        const diretor = criarProfissional({ id: 'dir' });
        const outroDiretor = criarProfissional({ id: 'dir-2' });

        projeto.aceitarRecomendacao(Papel.DIRETOR, diretor);
        expect(projeto.getEquipe()?.obterMembro(Papel.DIRETOR)?.getProfissional()).toBe(diretor);

        const anterior = projeto.substituirMembro(Papel.DIRETOR, outroDiretor);
        expect(anterior?.getProfissional()).toBe(diretor);
        expect(projeto.getEquipe()?.obterMembro(Papel.DIRETOR)?.getProfissional()).toBe(outroDiretor);

        const removido = projeto.rejeitarMembro(Papel.DIRETOR);
        expect(removido?.getProfissional().getId()).toBe('dir-2');
        expect(projeto.getProfissionaisRejeitados().has('dir-2')).toBe(true);
        expect(projeto.rejeitarMembro(Papel.EDITOR)).toBeNull();

        expect(() => projeto.aceitarRecomendacao(Papel.SONOPLASTA, diretor)).toThrow(ValidacaoError);
    });

    it('substituirMembro cria a equipe se ainda não existir', () => {
        const projeto = criarProjeto();
        expect(projeto.substituirMembro(Papel.DIRETOR, criarProfissional())).toBeNull();
        expect(projeto.getEquipe()).not.toBeNull();
    });

    it('define equipe apenas com papéis do projeto', () => {
        const projeto = criarProjeto();
        const equipeInvalida = new Equipe('e1', [new MembroEquipe(Papel.EDITOR, criarProfissional())]);
        expect(() => projeto.definirEquipe(equipeInvalida)).toThrow(ValidacaoError);
        const equipe = new Equipe('e2', [new MembroEquipe(Papel.DIRETOR, criarProfissional())]);
        projeto.definirEquipe(equipe);
        expect(projeto.getEquipe()).toBe(equipe);
    });

    it('altera orçamento, prazo, estratégia e solicita reavaliação', () => {
        const projeto = criarProjeto();
        projeto.aceitarRecomendacao(Papel.DIRETOR, criarProfissional());
        projeto.alterarOrcamento(80_000);
        projeto.alterarPrazo(new Date('2027-09-01'));
        projeto.definirEstrategia('regras-orcamento');
        expect(projeto.getOrcamento()).toBe(80_000);
        expect(projeto.getPrazo()).toEqual(new Date('2027-09-01'));
        expect(projeto.getEstrategia()).toBe('regras-orcamento');
        projeto.solicitarReavaliacao();
        expect(projeto.getEquipe()).toBeNull();
        expect(() => projeto.alterarOrcamento(0)).toThrow(ValidacaoError);
    });

    it('bloqueia alterações depois que a equipe é formada', () => {
        const projeto = criarProjeto();
        const diretor = criarProfissional({ id: 'd1' });
        projeto.aceitarRecomendacao(Papel.DIRETOR, diretor);
        const equipe = projeto.getEquipe()!;
        equipe.confirmarMembro(Papel.DIRETOR, 'd1');
        equipe.formar(projeto.getPapeis());

        expect(projeto.estaFormada()).toBe(true);
        expect(() => projeto.alterarOrcamento(1)).toThrow(ConflitoError);
        expect(() => projeto.solicitarReavaliacao()).toThrow(ConflitoError);
        expect(() => projeto.rejeitarMembro(Papel.DIRETOR)).toThrow(ConflitoError);
    });
});
