import { ValidacaoError } from '../erros.js';

export class Competencia {
    private readonly nome: string;
    private readonly nivel: number;

    constructor(nome: string, nivel: number) {
        const nomeLimpo = nome.trim();
        if (nomeLimpo.length === 0) {
            throw new ValidacaoError('Nome da competência é obrigatório');
        }
        if (!Number.isFinite(nivel) || nivel < 0 || nivel > 10) {
            throw new ValidacaoError(`Nível da competência "${nomeLimpo}" deve estar entre 0 e 10`);
        }
        this.nome = nomeLimpo;
        this.nivel = nivel;
    }

    public getNome(): string {
        return this.nome;
    }

    public getNivel(): number {
        return this.nivel;
    }
}
