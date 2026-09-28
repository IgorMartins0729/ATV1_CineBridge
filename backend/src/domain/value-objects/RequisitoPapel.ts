import { ValidacaoError } from '../erros.js';
import type { Papel } from '../enums/Papel.js';

/** Papel obrigatório de um projeto e seu peso relativo para o sucesso da obra. */
export class RequisitoPapel {
    private readonly papel: Papel;
    private readonly peso: number;

    constructor(papel: Papel, peso: number) {
        if (!Number.isFinite(peso) || peso <= 0) {
            throw new ValidacaoError(`Peso do papel ${papel} deve ser maior que zero`);
        }
        this.papel = papel;
        this.peso = peso;
    }

    public getPapel(): Papel {
        return this.papel;
    }

    public getPeso(): number {
        return this.peso;
    }
}
