export class Avaliacao {
    private nota: number
    private comentario: string
    private data: Date

    constructor(nota: number, comentario: string, data: Date){
        this.nota = nota;
        this.comentario = comentario;
        this.data = data;
    }

    public getNota(): number{
        return this.nota;
    }

    public getComentario(): string{
        return this.comentario;
    }

    public getData(): Date {
        return this.data;
    }
}