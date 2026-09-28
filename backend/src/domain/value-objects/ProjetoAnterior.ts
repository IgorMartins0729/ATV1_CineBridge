import type { TipoCaptacao } from '../enums/TipoCaptacao.js';

/** Item do histórico de projetos de um profissional. */
export interface ProjetoAnterior {
    readonly titulo: string;
    readonly genero: string;
    readonly tipoCaptacao: TipoCaptacao;
    readonly ano: number;
}
