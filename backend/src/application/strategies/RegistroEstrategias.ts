import type { Projeto } from '../../domain/entities/Projeto.js';
import { ValidacaoError } from '../../domain/erros.js';
import type { RecomendacaoStrategy } from './RecomendacaoStrategy.js';

export interface ConfigSelecaoEstrategia {
    /** Estratégia usada quando nada foi escolhido. */
    padrao: string;
    /** Abaixo deste orçamento, usa a estratégia de orçamento reduzido automaticamente. */
    limiteOrcamentoReduzido: number;
    estrategiaOrcamentoReduzido: string;
}

/** Catálogo das estratégias disponíveis, permitindo escolher uma pelo nome em tempo de execução. */
export class RegistroEstrategias {
    private readonly estrategias = new Map<string, RecomendacaoStrategy>();
    private readonly config: ConfigSelecaoEstrategia;

    constructor(estrategias: readonly RecomendacaoStrategy[], config: ConfigSelecaoEstrategia) {
        for (const estrategia of estrategias) {
            this.estrategias.set(estrategia.nome, estrategia);
        }
        this.config = config;
        this.obter(config.padrao);
        this.obter(config.estrategiaOrcamentoReduzido);
    }

    public obter(nome: string): RecomendacaoStrategy {
        const estrategia = this.estrategias.get(nome);
        if (!estrategia) {
            throw new ValidacaoError(`Estratégia desconhecida: "${nome}". Opções: ${this.nomes().join(', ')}`);
        }
        return estrategia;
    }

    public existe(nome: string): boolean {
        return this.estrategias.has(nome);
    }

    public nomes(): string[] {
        return [...this.estrategias.keys()];
    }

    public listar(): RecomendacaoStrategy[] {
        return [...this.estrategias.values()];
    }

    /** Escolha automática quando nem o projeto nem o produtor definiram uma estratégia. */
    public selecionarAutomatica(projeto: Projeto): RecomendacaoStrategy {
        return projeto.getOrcamento() < this.config.limiteOrcamentoReduzido
            ? this.obter(this.config.estrategiaOrcamentoReduzido)
            : this.obter(this.config.padrao);
    }
}
