import { randomUUID } from 'node:crypto';
import type { Papel } from '../enums/Papel.js';
import type { Profissional } from './Profissional.js';

/** Profissional candidato a um papel, com a pontuação calculada pela estratégia (0 a 1). */
export interface ProfissionalPontuado {
    readonly profissional: Profissional;
    readonly pontuacao: number;
}

/** Candidatos ordenados (do melhor para o pior) por papel. */
export type Ranking = Map<Papel, ProfissionalPontuado[]>;

export interface RecomendacaoProps {
    id?: string;
    projetoId: string;
    estrategia: string;
    ranking: Ranking;
    /** true quando a recomendação foi gerada com dados incompletos (fallback). */
    parcial: boolean;
    papeisSemCandidatos?: Papel[];
    geradaEm?: Date;
}

/** Resultado de uma rodada do motor de recomendação, guardado para auditoria. */
export class Recomendacao {
    private readonly id: string;
    private readonly projetoId: string;
    private readonly estrategia: string;
    private readonly ranking: Ranking;
    private readonly parcial: boolean;
    private readonly papeisSemCandidatos: Papel[];
    private readonly geradaEm: Date;

    constructor(props: RecomendacaoProps) {
        this.id = props.id ?? randomUUID();
        this.projetoId = props.projetoId;
        this.estrategia = props.estrategia;
        this.ranking = new Map([...props.ranking].map(([papel, lista]) => [papel, [...lista]]));
        this.parcial = props.parcial;
        this.papeisSemCandidatos = [...(props.papeisSemCandidatos ?? [])];
        this.geradaEm = new Date(props.geradaEm ?? new Date());
    }

    public getId(): string {
        return this.id;
    }

    public getProjetoId(): string {
        return this.projetoId;
    }

    public getEstrategia(): string {
        return this.estrategia;
    }

    public isParcial(): boolean {
        return this.parcial;
    }

    public getPapeisSemCandidatos(): readonly Papel[] {
        return this.papeisSemCandidatos;
    }

    public getGeradaEm(): Date {
        return new Date(this.geradaEm);
    }

    public getPapeis(): Papel[] {
        return [...this.ranking.keys()];
    }

    public getCandidatos(papel: Papel): readonly ProfissionalPontuado[] {
        return this.ranking.get(papel) ?? [];
    }

    public melhorCandidato(papel: Papel): ProfissionalPontuado | null {
        return this.getCandidatos(papel)[0] ?? null;
    }
}
