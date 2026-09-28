import { describe, expect, it } from 'vitest';
import { Convite } from '../../../src/domain/entities/Convite.js';
import { Equipe } from '../../../src/domain/entities/Equipe.js';
import { MembroEquipe } from '../../../src/domain/entities/MembroEquipe.js';
import { Recomendacao } from '../../../src/domain/entities/Recomendacao.js';
import { Papel } from '../../../src/domain/enums/Papel.js';
import { StatusConvite } from '../../../src/domain/enums/StatusConvite.js';
import { StatusEquipe } from '../../../src/domain/enums/StatusEquipe.js';
import { ConflitoError, NaoEncontradoError } from '../../../src/domain/erros.js';
import { criarProfissional } from '../../fixtures/fabricas.js';

describe('Equipe', () => {
    it('adiciona, troca, remove membros e calcula custo', () => {
        const equipe = new Equipe();
        const a = criarProfissional({ id: 'a', preco: 10_000 });
        const b = criarProfissional({ id: 'b', preco: 5_000 });

        expect(equipe.definirMembro(Papel.DIRETOR, a)).toBeNull();
        equipe.definirMembro(Papel.EDITOR, b);
        expect(equipe.custoTotal()).toBeCloseTo(15_000);
        expect(equipe.possuiProfissional('a')).toBe(true);
        expect(equipe.estaCompleta([Papel.DIRETOR, Papel.EDITOR])).toBe(true);
        expect(equipe.estaCompleta([Papel.DIRETOR, Papel.SONOPLASTA])).toBe(false);

        expect(equipe.removerMembro(Papel.EDITOR)?.getProfissional()).toBe(b);
        expect(equipe.getMembros()).toHaveLength(1);
        expect(equipe.getStatus()).toBe(StatusEquipe.EM_FORMACAO);
        expect(equipe.getDataFormacao()).toBeNull();
    });

    it('não permite o mesmo profissional em dois papéis', () => {
        const a = criarProfissional({ id: 'a' });
        const equipe = new Equipe('e', [new MembroEquipe(Papel.DIRETOR, a)]);
        expect(() => equipe.definirMembro(Papel.EDITOR, a)).toThrow(ConflitoError);
        expect(() => new Equipe('x', [new MembroEquipe(Papel.DIRETOR, a), new MembroEquipe(Papel.EDITOR, a)])).toThrow(
            ConflitoError
        );
    });

    it('só forma a equipe quando todos confirmaram', () => {
        const equipe = new Equipe();
        equipe.definirMembro(Papel.DIRETOR, criarProfissional({ id: 'd' }));
        equipe.definirMembro(Papel.EDITOR, criarProfissional({ id: 'e' }));
        const papeis = [Papel.DIRETOR, Papel.EDITOR];

        equipe.confirmarMembro(Papel.DIRETOR, 'd');
        expect(equipe.todosConfirmados(papeis)).toBe(false);
        expect(() => equipe.formar(papeis)).toThrow(ConflitoError);
        expect(() => equipe.confirmarMembro(Papel.EDITOR, 'outro')).toThrow(NaoEncontradoError);

        equipe.confirmarMembro(Papel.EDITOR, 'e');
        equipe.formar(papeis, new Date('2027-02-01'));
        expect(equipe.estaFormada()).toBe(true);
        expect(equipe.getDataFormacao()).toEqual(new Date('2027-02-01'));
        expect(() => equipe.removerMembro(Papel.EDITOR)).toThrow(ConflitoError);
    });
});

describe('Convite', () => {
    it('começa pendente e pode ser aceito uma única vez', () => {
        const profissional = criarProfissional();
        const convite = new Convite({ projetoId: 'p1', papel: Papel.DIRETOR, profissional });
        expect(convite.getStatus()).toBe(StatusConvite.PENDENTE);
        expect(convite.getRespondidoEm()).toBeNull();
        convite.aceitar(new Date('2027-01-02'));
        expect(convite.getStatus()).toBe(StatusConvite.ACEITO);
        expect(convite.getRespondidoEm()).toEqual(new Date('2027-01-02'));
        expect(() => convite.recusar()).toThrow(ConflitoError);
        expect(convite.getProjetoId()).toBe('p1');
        expect(convite.getPapel()).toBe(Papel.DIRETOR);
        expect(convite.getProfissional()).toBe(profissional);
        expect(convite.getId()).toBeTruthy();
        expect(convite.getCriadoEm()).toBeInstanceOf(Date);
    });

    it('pode ser recusado ou cancelado', () => {
        const recusado = new Convite({ projetoId: 'p', papel: Papel.EDITOR, profissional: criarProfissional() });
        recusado.recusar();
        expect(recusado.getStatus()).toBe(StatusConvite.RECUSADO);

        const cancelado = new Convite({
            id: 'c1',
            projetoId: 'p',
            papel: Papel.EDITOR,
            profissional: criarProfissional(),
            respondidoEm: null
        });
        cancelado.cancelar();
        expect(cancelado.getStatus()).toBe(StatusConvite.CANCELADO);
        expect(cancelado.estaPendente()).toBe(false);
    });
});

describe('Recomendacao', () => {
    it('guarda o ranking por papel e o melhor candidato', () => {
        const a = criarProfissional({ id: 'a' });
        const recomendacao = new Recomendacao({
            projetoId: 'p1',
            estrategia: 'similaridade-cosseno',
            ranking: new Map([[Papel.DIRETOR, [{ profissional: a, pontuacao: 0.9 }]]]),
            parcial: true,
            papeisSemCandidatos: [Papel.EDITOR]
        });
        expect(recomendacao.getPapeis()).toEqual([Papel.DIRETOR]);
        expect(recomendacao.melhorCandidato(Papel.DIRETOR)?.profissional).toBe(a);
        expect(recomendacao.melhorCandidato(Papel.EDITOR)).toBeNull();
        expect(recomendacao.getCandidatos(Papel.EDITOR)).toEqual([]);
        expect(recomendacao.isParcial()).toBe(true);
        expect(recomendacao.getPapeisSemCandidatos()).toEqual([Papel.EDITOR]);
        expect(recomendacao.getEstrategia()).toBe('similaridade-cosseno');
        expect(recomendacao.getProjetoId()).toBe('p1');
        expect(recomendacao.getId()).toBeTruthy();
        expect(recomendacao.getGeradaEm()).toBeInstanceOf(Date);
    });
});
