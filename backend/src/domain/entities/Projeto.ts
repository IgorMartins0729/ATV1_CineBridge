export class Projeto {
    private id: string
    private genero: string
    private duracao: number
    private orcamento: number
    private prazo: Date

    constructor (id: string, genero: string, duracao: number, orcamento: number, prazo: Date){
        this.id = id;
        this.genero = genero;
        this.duracao = duracao;
        this.orcamento = orcamento;
        this.prazo = prazo;
    }

    public getId():string {
        return this.id;
    }

    public getGenero(): string{
        return this.genero;
    }

    public getDuracao(): number{
        return this.duracao;
    }

    public getOrcamento(): number{
        return this.orcamento;
    }

    public getPrazo(): Date{
        return this.prazo;
    }
}