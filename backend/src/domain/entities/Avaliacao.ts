import { ValidacaoError } from '../erros.js';

export class Avaliacao {
    private readonly nota: number;
    private readonly comentario: string;
    private readonly data: Date;

    constructor(nota: number, comentario: string, data: Date) {
        if (!Number.isFinite(nota) || nota < 0 || nota > 5) {
            throw new ValidacaoError('Nota da avaliação deve estar entre 0 e 5');
        }
        if (Number.isNaN(data.getTime())) {
            throw new ValidacaoError('Data da avaliação inválida');
        }
        this.nota = nota;
        this.comentario = comentario;
        this.data = new Date(data);
    }

    public getNota(): number {
        return this.nota;
    }

    public getComentario(): string {
        return this.comentario;
    }

    public getData(): Date {
        return new Date(this.data);
    }
}
