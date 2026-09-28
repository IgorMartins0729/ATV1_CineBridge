import type { Projeto } from '../../domain/entities/Projeto.js';

export interface IProjetoRepository {
    salvar(projeto: Projeto): Promise<void>;

    buscarPorId(id: string): Promise<Projeto | null>;
}
