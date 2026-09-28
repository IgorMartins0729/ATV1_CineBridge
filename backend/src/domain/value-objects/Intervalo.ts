import { ValidacaoError } from '../erros.js';

/** Período de disponibilidade de um profissional (inclusivo nas duas pontas). */
export class Intervalo {
    // Guardado como milissegundos: comparar números é bem mais rápido que comparar objetos Date,
    // e esta verificação roda milhares de vezes por recomendação.
    private readonly inicio: number;
    private readonly fim: number;

    constructor(inicio: Date, fim: Date) {
        const inicioMs = inicio.getTime();
        const fimMs = fim.getTime();
        if (Number.isNaN(inicioMs) || Number.isNaN(fimMs)) {
            throw new ValidacaoError('Intervalo com data inválida');
        }
        if (fimMs < inicioMs) {
            throw new ValidacaoError('O fim do intervalo não pode ser anterior ao início');
        }
        this.inicio = inicioMs;
        this.fim = fimMs;
    }

    public getInicio(): Date {
        return new Date(this.inicio);
    }

    public getFim(): Date {
        return new Date(this.fim);
    }

    public contem(data: Date): boolean {
        const ms = data.getTime();
        return ms >= this.inicio && ms <= this.fim;
    }
}
