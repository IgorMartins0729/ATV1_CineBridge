import type { Profissional } from '../../domain/entities/Profissional.js';
import type { Papel } from '../../domain/enums/Papel.js';

/** Filtro aplicado já na fonte de dados, para não carregar os 10 mil profissionais a cada pedido. */
export interface FiltroCandidatos {
    /** Profissionais com ao menos uma dessas especialidades. */
    papeis: readonly Papel[];
    /** Precisa estar disponível nesta data (data de entrega do projeto). */
    disponivelEm?: Date;
    /** Preço médio máximo aceito. */
    precoMaximo?: number;
    excluirIds?: readonly string[];
}

export interface IProfissionalRepository {
    listarTodos(): Promise<Profissional[]>;

    buscarPorId(id: string): Promise<Profissional | null>;

    buscarCandidatos(filtro: FiltroCandidatos): Promise<Profissional[]>;

    salvar(profissional: Profissional): Promise<void>;

    contar(): Promise<number>;
}
