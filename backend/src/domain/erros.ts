export abstract class ErroDominio extends Error {
    abstract readonly codigo: string;

    constructor(mensagem: string) {
        super(mensagem);
        this.name = new.target.name;
    }
}

/** Dados de entrada inválidos (ex.: nota fora da faixa, orçamento negativo). */
export class ValidacaoError extends ErroDominio {
    readonly codigo = 'VALIDACAO';
}

/** Recurso procurado não existe. */
export class NaoEncontradoError extends ErroDominio {
    readonly codigo = 'NAO_ENCONTRADO';
}

/** Operação válida, mas não permitida no estado atual (ex.: alterar equipe já formada). */
export class ConflitoError extends ErroDominio {
    readonly codigo = 'CONFLITO';
}

/** O projeto não atende às restrições mínimas para gerar uma recomendação. */
export class RestricaoInvalidaError extends ErroDominio {
    readonly codigo = 'RESTRICAO_INVALIDA';
    private readonly problemas: string[];

    constructor(problemas: string[]) {
        super(`Projeto não atende às restrições: ${problemas.join('; ')}`);
        this.problemas = [...problemas];
    }

    public getProblemas(): readonly string[] {
        return this.problemas;
    }
}
