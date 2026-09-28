/** Dados mínimos do produtor responsável pelo projeto (dono do cadastro em outro microsserviço). */
export interface Produtor {
    readonly id: string;
    readonly nome: string;
    readonly email: string;
}
