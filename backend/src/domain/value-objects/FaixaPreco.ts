import { ValidacaoError } from '../erros.js';

/** Faixa de preço cobrada por um profissional para um projeto. */
export class FaixaPreco {
    private readonly minimo: number;
    private readonly maximo: number;

    constructor(minimo: number, maximo: number) {
        if (!Number.isFinite(minimo) || !Number.isFinite(maximo) || minimo < 0) {
            throw new ValidacaoError('Faixa de preço deve ter valores numéricos não negativos');
        }
        if (maximo < minimo) {
            throw new ValidacaoError('Preço máximo não pode ser menor que o mínimo');
        }
        this.minimo = minimo;
        this.maximo = maximo;
    }

    public getMinimo(): number {
        return this.minimo;
    }

    public getMaximo(): number {
        return this.maximo;
    }

    public getMedia(): number {
        return (this.minimo + this.maximo) / 2;
    }
}
