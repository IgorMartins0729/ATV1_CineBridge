import type { MembroEquipe } from "./MembroEquipe.js"

export class Equipe {
    private id: string
    private dataFormacao: Date
    private status: string
    private membros: MembroEquipe[]

    constructor(id: string, dataFormacao: Date, status: string, membros: MembroEquipe[]){
        this.id = id;
        this.dataFormacao = dataFormacao;
        this.status = status;
        this.membros = membros;
    }

    public getId(): string{
        return this.id;
    }

    public getDataFormacao(): Date {
        return this.dataFormacao;
    }

    public getStatus(): string {
        return this.status;
    }

    public getMembros(): MembroEquipe[]{
        return this.membros;
    }
}