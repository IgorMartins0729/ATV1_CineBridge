import { ValidacaoError } from '../erros.js';

export class Localizacao {
    private readonly cidade: string;
    private readonly uf: string;

    constructor(cidade: string, uf: string) {
        const cidadeLimpa = cidade.trim();
        const ufLimpa = uf.trim().toUpperCase();
        if (cidadeLimpa.length === 0) {
            throw new ValidacaoError('Cidade é obrigatória');
        }
        if (!/^[A-Z]{2}$/.test(ufLimpa)) {
            throw new ValidacaoError(`UF inválida: "${uf}"`);
        }
        this.cidade = cidadeLimpa;
        this.uf = ufLimpa;
    }

    public getCidade(): string {
        return this.cidade;
    }

    public getUf(): string {
        return this.uf;
    }

    public mesmaCidade(outra: Localizacao): boolean {
        return this.mesmoEstado(outra) && this.cidade.toLowerCase() === outra.cidade.toLowerCase();
    }

    public mesmoEstado(outra: Localizacao): boolean {
        return this.uf === outra.uf;
    }

    public toString(): string {
        return `${this.cidade}/${this.uf}`;
    }
}
