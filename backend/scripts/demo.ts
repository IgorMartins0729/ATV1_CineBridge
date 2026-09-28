import type { Observador } from '../src/application/observers/Observador.js';
import { OrquestradorEquipe } from '../src/application/orquestrador/OrquestradorEquipe.js';
import { OrquestradorPadrao } from '../src/application/orquestrador/OrquestradorPadrao.js';
import { CalculadorCompatibilidade } from '../src/application/visitors/CalculadorCompatibilidade.js';
import { GeradorRelatorio } from '../src/application/visitors/GeradorRelatorio.js';
import { ValidadorConsistencia } from '../src/application/visitors/ValidadorConsistencia.js';
import { criarContainer } from '../src/config/container.js';
import type { Profissional } from '../src/domain/entities/Profissional.js';
import type { Projeto } from '../src/domain/entities/Projeto.js';
import type { Ranking } from '../src/domain/entities/Recomendacao.js';
import { Papel, rotuloPapel } from '../src/domain/enums/Papel.js';
import { TipoCaptacao } from '../src/domain/enums/TipoCaptacao.js';
import { gerarProfissionais } from '../src/infrastructure/dados/geradorProfissionais.js';
import { LoggerMemoria } from '../src/infrastructure/logging/LoggerMemoria.js';

/** Demonstração dos quatro padrões com casos de uso concretos. Uso: npm run demo */

const titulo = (texto: string): void => console.log(`\n${'='.repeat(70)}\n${texto}\n${'='.repeat(70)}`);
const moeda = (valor: number): string => `R$ ${Math.round(valor).toLocaleString('pt-BR')}`;

const container = criarContainer({ profissionais: gerarProfissionais(2_000), logger: new LoggerMemoria() });
const prazo = new Date(Date.now() + 200 * 86_400_000);
const dadosProjeto = {
    titulo: 'Vozes do Sertão',
    produtor: { id: 'produtora-1', nome: 'Paula Lima', email: 'paula@produtora.com' },
    genero: 'drama',
    duracao: 95,
    orcamento: 180_000,
    prazo,
    tipoCaptacao: TipoCaptacao.FICCAO,
    localizacao: { cidade: 'Recife', uf: 'PE' },
    papeisObrigatorios: [
        { papel: Papel.DIRETOR, peso: 3 },
        { papel: Papel.DIRETOR_FOTOGRAFIA, peso: 2 },
        { papel: Papel.EDITOR, peso: 1 }
    ]
};

// ---------------------------------------------------------------------------------------------
titulo('1) STRATEGY - a troca de estratégia altera o resultado da recomendação');
for (const estrategia of container.estrategias.listar()) {
    const projeto = await container.projetoService.criar({ ...dadosProjeto, estrategia: estrategia.nome });
    const { recomendacao } = await container.sistema.executarRecomendacao(projeto);
    const top = recomendacao.getCandidatos(Papel.DIRETOR).slice(0, 3);
    console.log(`\n[${estrategia.nome}] ${estrategia.descricao}`);
    for (const [i, c] of top.entries()) {
        const p = c.profissional;
        console.log(
            `  ${i + 1}º ${p.getNome().padEnd(20)} nota ${c.pontuacao.toFixed(3)} | ${moeda(p.getPrecoMedio()).padEnd(11)} | ` +
                `avaliação ${p.mediaAvaliacoes().toFixed(1)} | ${p.getLocalizacao().toString()}`
        );
    }
}

// ---------------------------------------------------------------------------------------------
titulo('2) TEMPLATE METHOD - o fluxo principal é fixo; subclasses só mudam as etapas');
class OrquestradorComLog extends OrquestradorEquipe {
    readonly etapas: string[] = [];
    constructor() {
        super({ quantidadeSugestoes: 1 });
    }
    protected validarRestricoes(): string[] {
        this.etapas.push('1. validarRestricoes');
        return [];
    }
    protected normalizarDados(_p: Projeto, profissionais: readonly Profissional[]): Profissional[] {
        this.etapas.push('2. normalizarDados');
        return [...profissionais];
    }
    protected posProcessar(_p: Projeto, ranking: Ranking): Ranking {
        this.etapas.push('3. posProcessar');
        return ranking;
    }
}
const orquestrador = new OrquestradorComLog();
const projetoTemplate = await container.projetoService.criar(dadosProjeto);
orquestrador.orquestrar(projetoTemplate, await container.repositorios.profissionais.listarTodos(), container.estrategias.obter('similaridade-cosseno'));
console.log('Ordem das etapas chamadas pelo método template:', orquestrador.etapas.join(' -> '));
try {
    class OrquestradorRebelde extends OrquestradorPadrao {
        override orquestrar(): never {
            throw new Error('fluxo alterado');
        }
    }
    new OrquestradorRebelde();
} catch (erro) {
    console.log('Tentativa de sobrescrever o fluxo:', (erro as Error).message);
}

// ---------------------------------------------------------------------------------------------
titulo('3) OBSERVER - observadores reagem de forma independente aos eventos');
console.log('Observadores registrados:', container.sistema.getObservadores().join(', '));
const quebrado: Observador = {
    nome: 'ObservadorComDefeito',
    atualizar: () => {
        throw new Error('servidor SMTP fora do ar');
    }
};
container.sistema.adicionarObservador(quebrado);
const emailsAntes = container.canais.email.getEnviados().length;
const auditoriaAntes = (await container.canais.auditoria.listar()).length;

const projeto = await container.projetoService.criar(dadosProjeto);
await container.gestaoEquipe.recomendarEquipe(projeto.getId());
container.sistema.removerObservador(quebrado);

console.log(`Mesmo com um observador falhando: +${container.canais.email.getEnviados().length - emailsAntes} e-mails,`,
    `+${(await container.canais.auditoria.listar()).length - auditoriaAntes} registro(s) de auditoria`);
const exemploEmail = container.canais.email.getEnviados().at(-1);
console.log(`Exemplo de e-mail -> ${exemploEmail?.para}: "${exemploEmail?.assunto}"`);

console.log('\nProdutor aceita os sugeridos; os profissionais respondem aos convites:');
for (const requisito of projeto.getPapeisObrigatorios()) {
    const convite = await container.gestaoEquipe.aceitarMembro(projeto.getId(), requisito.getPapel());
    const aceita = requisito.getPapel() !== Papel.EDITOR; // o editor vai recusar
    await container.conviteService.responder(convite.getId(), aceita);
    console.log(`  ${rotuloPapel(requisito.getPapel()).padEnd(22)} ${convite.getProfissional().getNome().padEnd(20)} ${aceita ? 'ACEITOU' : 'RECUSOU'}`);
}
const novoEditor = projeto.getEquipe()!.obterMembro(Papel.EDITOR)!.getProfissional();
console.log(`Recusa observada -> nova rodada só para Edição: ${novoEditor.getNome()} (demais membros mantidos)`);
const conviteEditor = await container.gestaoEquipe.aceitarMembro(projeto.getId(), Papel.EDITOR);
await container.conviteService.responder(conviteEditor.getId(), true);
console.log(`Equipe: ${projeto.getEquipe()!.getStatus()} | eventos enviados ao financeiro: ${container.integracoes.financeiro.getEnviados().length},`,
    `ao gerenciamento de projetos: ${container.integracoes.gerenciamentoProjetos.getEnviados().length}`);
const tipos = (await container.canais.auditoria.listar()).map((r) => r.tipo);
console.log('Trilha de auditoria (tipos):', [...new Set(tipos)].join(', '));

// ---------------------------------------------------------------------------------------------
titulo('4) VISITOR - operações diferentes sobre a mesma estrutura, sem alterar as classes');
const validador = new ValidadorConsistencia();
console.log('ValidadorConsistencia  ->', projeto.aceitar(validador), validador.getProblemas());
console.log('CalculadorCompatibilidade ->', projeto.aceitar(new CalculadorCompatibilidade()), '/ 100');
console.log('GeradorRelatorio ->\n');
console.log(projeto.aceitar(new GeradorRelatorio()));
