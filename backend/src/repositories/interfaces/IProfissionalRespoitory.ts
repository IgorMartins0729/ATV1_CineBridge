import { Profissional } from "../../domain/entities/Profissional.js";

export interface IProfissionalRepository {
    listarTodos(): Promise<Profissional[]>;

    buscarPorId(id: string): Promise<Profissional | null>;
    
    salvar(profissional: Profissional): Promise<Profissional | void>;
}