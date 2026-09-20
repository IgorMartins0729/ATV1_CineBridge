import type { Papel } from "../enums/Papel.js"

export class MembroEquipe {
    private papel: Papel
    private confirmado: boolean

    constructor(papel: Papel, confirmado: boolean){
        this.papel = papel;
        this.confirmado = confirmado;
    }

    public getPapel(): Papel{
        return this.papel;
    }

    public getConfirmado(): boolean{
        return this.confirmado;
    }
}