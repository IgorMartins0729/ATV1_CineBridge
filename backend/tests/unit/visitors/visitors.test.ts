import { describe, expect, it } from 'vitest';
import { CalculadorCompatibilidade } from '../../../src/application/visitors/CalculadorCompatibilidade.js';
import { GeradorRelatorio } from '../../../src/application/visitors/GeradorRelatorio.js';
import { ValidadorConsistencia } from '../../../src/application/visitors/ValidadorConsistencia.js';
import { Papel } from '../../../src/domain/enums/Papel.js';
import type { VisitanteProjeto } from '../../../src/domain/visitors/VisitanteProjeto.js';
import { criarProfissional, criarProjeto } from '../../fixtures/fabricas.js';

function projetoComEquipe() {
    const projeto = criarProjeto({
        titulo: 'Sertão Digital',
        orcamento: 50_000,
        papeis: [[Papel.DIRETOR, 3], [Papel.EDITOR, 1]]
    });
    const diretor = criarProfissional({
        id: 'dir',
        nome: 'Clara Diretora',
        preco: 30_000,
        notas: [5, 5],
        competencias: { direcao: 10, roteiro: 8 }
    });
    const editor = criarProfissional({
        id: 'edi',
        nome: 'Téo Editor',
        especialidades: [Papel.EDITOR],
        preco: 10_000,
        notas: [4],
        competencias: { montagem: 8 },
        cidade: 'Recife',
        uf: 'PE'
    });
    projeto.aceitarRecomendacao(Papel.DIRETOR, diretor);
    projeto.aceitarRecomendacao(Papel.EDITOR, editor);
    projeto.getEquipe()!.confirmarMembro(Papel.DIRETOR, 'dir');
    return { projeto, diretor, editor };
}

describe('Visitor: operações diferentes sobre a mesma estrutura', () => {
    it('os três visitantes percorrem o mesmo projeto e produzem resultados distintos sem alterá-lo', () => {
        const { projeto } = projetoComEquipe();
        const antes = {
            orcamento: projeto.getOrcamento(),
            membros: projeto.getEquipe()!.getMembros().map((m) => m.getProfissional().getId())
        };

        const visitantes: Array<VisitanteProjeto<unknown>> = [
            new ValidadorConsistencia(),
            new CalculadorCompatibilidade(),
            new GeradorRelatorio()
        ];
        const resultados = visitantes.map((v) => projeto.aceitar(v));

        expect(typeof resultados[0]).toBe('boolean');
        expect(typeof resultados[1]).toBe('number');
        expect(typeof resultados[2]).toBe('string');
        expect({
            orcamento: projeto.getOrcamento(),
            membros: projeto.getEquipe()!.getMembros().map((m) => m.getProfissional().getId())
        }).toEqual(antes);
    });
});

describe('ValidadorConsistencia', () => {
    it('aprova equipe completa, dentro do orçamento e com membros aptos', () => {
        const { projeto } = projetoComEquipe();
        const validador = new ValidadorConsistencia();
        expect(projeto.aceitar(validador)).toBe(true);
        expect(validador.getProblemas()).toEqual([]);
    });

    it('aponta projeto sem equipe', () => {
        const validador = new ValidadorConsistencia();
        expect(criarProjeto().aceitar(validador)).toBe(false);
        expect(validador.getProblemas()).toEqual(['o projeto ainda não tem equipe']);
    });

    it('aponta papel vago, orçamento estourado e membro indisponível', () => {
        const projeto = criarProjeto({ orcamento: 5_000, papeis: [[Papel.DIRETOR, 1], [Papel.EDITOR, 1]] });
        projeto.aceitarRecomendacao(
            Papel.DIRETOR,
            criarProfissional({ nome: 'Rui', preco: 20_000, disponivelAte: new Date('2027-02-01') })
        );
        const validador = new ValidadorConsistencia();
        expect(projeto.aceitar(validador)).toBe(false);
        expect(validador.getProblemas()).toEqual([
            'papel obrigatório sem profissional: Edição',
            'custo da equipe (R$ 20.000,00) passa do orçamento (R$ 5.000,00)',
            'Rui não está disponível na data de entrega'
        ]);
    });

    it('valida um profissional isolado e um membro sem a especialidade', () => {
        const validador = new ValidadorConsistencia();
        expect(criarProfissional({ nome: 'Sem', competencias: {} }).aceitar(validador)).toBe(false);
        expect(validador.getProblemas()).toEqual(['Sem não tem competências cadastradas']);

        const projeto = criarProjeto({ papeis: [[Papel.EDITOR, 1]] });
        projeto.aceitarRecomendacao(Papel.EDITOR, criarProfissional({ nome: 'Dani', especialidades: [Papel.DIRETOR] }));
        const outro = new ValidadorConsistencia();
        expect(projeto.aceitar(outro)).toBe(false);
        expect(outro.getProblemas()).toEqual(['Dani não tem especialidade em Edição']);
    });
});

describe('CalculadorCompatibilidade', () => {
    it('pondera a nota de cada membro pelo peso do papel', () => {
        const { projeto, diretor, editor } = projetoComEquipe();
        const calculador = new CalculadorCompatibilidade();
        // Fora do contexto de um projeto: proximidade neutra (0,5) e disponibilidade 1.
        // diretora: 0,35x1 + 0,35x0,9 + 0,15x0,5 + 0,15x1 = 0,89
        expect(diretor.aceitar(calculador)).toBe(89);
        // editor: 0,35x0,8 + 0,35x0,8 + 0,15x0,5 + 0,15x1 = 0,785
        expect(editor.aceitar(calculador)).toBe(78.5);

        // Dentro do projeto (São Paulo): diretora é da mesma cidade (96,5), editor é de outro estado (71).
        // (3 x 96,5 + 1 x 71) / 4 = 90,125 -> 90,1
        expect(projeto.aceitar(calculador)).toBe(90.1);
    });

    it('papel vago conta como zero e projeto sem equipe vale zero', () => {
        const projeto = criarProjeto({ papeis: [[Papel.DIRETOR, 1], [Papel.EDITOR, 1]] });
        expect(projeto.aceitar(new CalculadorCompatibilidade())).toBe(0);
        projeto.aceitarRecomendacao(Papel.DIRETOR, criarProfissional({ notas: [5], competencias: { direcao: 10 } }));
        expect(projeto.aceitar(new CalculadorCompatibilidade())).toBe(50);
    });
});

describe('GeradorRelatorio', () => {
    it('gera um relatório com dados do projeto, membros, custo, compatibilidade e consistência', () => {
        const { projeto } = projetoComEquipe();
        const relatorio = projeto.aceitar(new GeradorRelatorio());
        expect(relatorio).toContain('RELATÓRIO DO PROJETO: Sertão Digital');
        expect(relatorio).toContain('Orçamento: R$ 50.000,00');
        expect(relatorio).toContain('- Direção (peso 3): Clara Diretora (São Paulo/SP)');
        expect(relatorio).toContain('[confirmado]');
        expect(relatorio).toContain('Téo Editor (Recife/PE)');
        expect(relatorio).toContain('[aguardando confirmação]');
        expect(relatorio).toContain('Custo total: R$ 40.000,00');
        expect(relatorio).toContain('Compatibilidade geral: 90.1/100');
        expect(relatorio).toContain('Consistência: OK');
    });

    it('mostra papéis vagos e os problemas encontrados', () => {
        const projeto = criarProjeto({ papeis: [[Papel.DIRETOR, 1]] });
        const relatorio = projeto.aceitar(new GeradorRelatorio());
        expect(relatorio).toContain('EQUIPE (sem equipe)');
        expect(relatorio).toContain('- Direção (peso 1): VAGO');
        expect(relatorio).toContain('! o projeto ainda não tem equipe');
        expect(relatorio).toContain('Estratégia: automática');
    });

    it('descreve um profissional sem competências', () => {
        expect(criarProfissional({ nome: 'Zé', competencias: {} }).aceitar(new GeradorRelatorio())).toContain(
            'principais competências: nenhuma'
        );
    });
});
