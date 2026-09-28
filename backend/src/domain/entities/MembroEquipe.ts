import type { Papel } from '../enums/Papel.js';
import type { Profissional } from './Profissional.js';

export class MembroEquipe {
    private readonly papel: Papel;
    private readonly profissional: Profissional;
    private confirmado: boolean;

    constructor(papel: Papel, profissional: Profissional, confirmado = false) {
        this.papel = papel;
        this.profissional = profissional;
        this.confirmado = confirmado;
    }

    public getPapel(): Papel {
        return this.papel;
    }

    public getProfissional(): Profissional {
        return this.profissional;
    }

    public getConfirmado(): boolean {
        return this.confirmado;
    }

    /** O profissional aceitou o convite para o papel. */
    public confirmar(): void {
        this.confirmado = true;
    }
}
