export class Competencia { 
    private nome: string
    private nivel: number

    constructor(nome: string, nivel: number){
        this.nome = nome;
        this.nivel = nivel;
    }

    public getNome(): string {
        return this.nome;
    }

    public getNivel(): number {
        return this.nivel;
    }
}