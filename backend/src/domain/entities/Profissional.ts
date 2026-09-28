import { ValidacaoError } from '../erros.js';
import type { Papel } from '../enums/Papel.js';
import type { FaixaPreco } from '../value-objects/FaixaPreco.js';
import type { Intervalo } from '../value-objects/Intervalo.js';
import type { Localizacao } from '../value-objects/Localizacao.js';
import type { ProjetoAnterior } from '../value-objects/ProjetoAnterior.js';
import type { VisitanteProjeto, Visitavel } from '../visitors/VisitanteProjeto.js';
import type { Avaliacao } from './Avaliacao.js';
import type { Competencia } from './Competencia.js';

export interface ProfissionalProps {
    id: string;
    nome: string;
    email: string;
    especialidades: Papel[];
    competencias: Competencia[];
    avaliacoes?: Avaliacao[];
    historicoProjetos?: ProjetoAnterior[];
    faixaPreco: FaixaPreco;
    disponibilidade: Intervalo;
    localizacao: Localizacao;
}

export class Profissional implements Visitavel {
    private readonly id: string;
    private readonly nome: string;
    private readonly email: string;
    private readonly especialidades: Papel[];
    private readonly competencias: Competencia[];
    private readonly avaliacoes: Avaliacao[];
    private readonly historicoProjetos: ProjetoAnterior[];
    private readonly faixaPreco: FaixaPreco;
    private readonly disponibilidade: Intervalo;
    private readonly localizacao: Localizacao;
    // Valores derivados calculados uma vez (os dados acima não mudam depois da criação).
    // O motor de recomendação consulta isso milhares de vezes por requisição.
    private readonly niveis: Map<string, number>;
    private readonly conjuntoEspecialidades: ReadonlySet<Papel>;
    private readonly precoMedio: number;
    private readonly media: number;
    private readonly nivelMedio: number;

    constructor(props: ProfissionalProps) {
        if (props.id.trim().length === 0) {
            throw new ValidacaoError('Id do profissional é obrigatório');
        }
        if (props.nome.trim().length === 0) {
            throw new ValidacaoError('Nome do profissional é obrigatório');
        }
        if (props.especialidades.length === 0) {
            throw new ValidacaoError(`Profissional "${props.nome}" precisa de ao menos uma especialidade`);
        }
        this.id = props.id;
        this.nome = props.nome.trim();
        this.email = props.email.trim();
        this.especialidades = [...new Set(props.especialidades)];
        this.competencias = [...props.competencias];
        this.avaliacoes = [...(props.avaliacoes ?? [])];
        this.historicoProjetos = [...(props.historicoProjetos ?? [])];
        this.faixaPreco = props.faixaPreco;
        this.disponibilidade = props.disponibilidade;
        this.localizacao = props.localizacao;
        this.niveis = new Map();
        for (const competencia of this.competencias) {
            const chave = competencia.getNome().toLowerCase();
            if (!this.niveis.has(chave)) this.niveis.set(chave, competencia.getNivel());
        }
        this.conjuntoEspecialidades = new Set(this.especialidades);
        this.precoMedio = this.faixaPreco.getMedia();
        this.media =
            this.avaliacoes.length === 0
                ? 0
                : this.avaliacoes.reduce((total, a) => total + a.getNota(), 0) / this.avaliacoes.length;
        this.nivelMedio =
            this.competencias.length === 0
                ? 0
                : this.competencias.reduce((total, c) => total + c.getNivel(), 0) / this.competencias.length;
    }

    public getId(): string {
        return this.id;
    }

    public getNome(): string {
        return this.nome;
    }

    public getEmail(): string {
        return this.email;
    }

    public getEspecialidades(): readonly Papel[] {
        return this.especialidades;
    }

    public getCompetencias(): readonly Competencia[] {
        return this.competencias;
    }

    public getAvaliacoes(): readonly Avaliacao[] {
        return this.avaliacoes;
    }

    public getHistoricoProjetos(): readonly ProjetoAnterior[] {
        return this.historicoProjetos;
    }

    public getFaixaPreco(): FaixaPreco {
        return this.faixaPreco;
    }

    public getPrecoMedio(): number {
        return this.precoMedio;
    }

    public getDisponibilidade(): Intervalo {
        return this.disponibilidade;
    }

    public getLocalizacao(): Localizacao {
        return this.localizacao;
    }

    public possuiEspecialidade(papel: Papel): boolean {
        return this.conjuntoEspecialidades.has(papel);
    }

    public estaDisponivelEm(data: Date): boolean {
        return this.disponibilidade.contem(data);
    }

    /** Média das notas recebidas (0 quando não há avaliações). */
    public mediaAvaliacoes(): number {
        return this.media;
    }

    public nivelEm(nomeCompetencia: string): number {
        return this.niveis.get(nomeCompetencia.toLowerCase()) ?? 0;
    }

    /** Vetor de competências na ordem das dimensões pedidas (0 para competência ausente). */
    public vetorCompetencias(dimensoes: readonly string[]): number[] {
        return dimensoes.map((dimensao) => this.nivelEm(dimensao));
    }

    public nivelMedioCompetencias(): number {
        return this.nivelMedio;
    }

    public aceitar<R>(visitante: VisitanteProjeto<R>): R {
        return visitante.visitarProfissional(this);
    }
}
