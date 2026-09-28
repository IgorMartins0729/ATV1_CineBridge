import type { Convite } from '../../domain/entities/Convite.js';

export interface IConviteRepository {
    salvar(convite: Convite): Promise<void>;

    buscarPorId(id: string): Promise<Convite | null>;

    listarPorProjeto(projetoId: string): Promise<Convite[]>;
}
