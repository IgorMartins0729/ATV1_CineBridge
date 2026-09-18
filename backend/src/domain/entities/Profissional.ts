import type { Competencia } from "./Competencia.js";

export class Profissional {
    private id: string
    private nome: string
    private competencias: Competencia[] 
    private disponibilidade: { inicio: Date; fim: Date}
    private precoMedio: number

    constructor(id: string, nome: string, competencias: Competencia[], disponibilidade: { inicio: Date; fim: Date }, precoMedio: number){
        this.id = id;
        this.nome = nome;
        this.competencias = competencias;
        this.disponibilidade = disponibilidade;
        this.precoMedio = precoMedio;
    }

    public getId(): string{
        return this.id;
    }

    public getNome(): string{
        return this.nome;
    }

    public getCompetencias(): Competencia[]{
        return this.competencias;
    }

    public getDisponibilidade(): { inicio: Date; fim: Date}{
        return this.disponibilidade;
    }

    public getPrecoMedio(): number{
        return this.precoMedio;
    }
}