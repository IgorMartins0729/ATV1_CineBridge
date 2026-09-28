import type { IConviteRepository } from '../../../application/ports/IConviteRepository.js';
import type { Convite } from '../../../domain/entities/Convite.js';

export class ConviteRepositoryMemoria implements IConviteRepository {
    private readonly convites = new Map<string, Convite>();

    public async salvar(convite: Convite): Promise<void> {
        this.convites.set(convite.getId(), convite);
    }

    public async buscarPorId(id: string): Promise<Convite | null> {
        return this.convites.get(id) ?? null;
    }

    public async listarPorProjeto(projetoId: string): Promise<Convite[]> {
        return [...this.convites.values()].filter((c) => c.getProjetoId() === projetoId);
    }
}
