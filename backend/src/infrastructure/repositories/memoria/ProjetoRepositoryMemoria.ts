import type { IProjetoRepository } from '../../../application/ports/IProjetoRepository.js';
import type { Projeto } from '../../../domain/entities/Projeto.js';

export class ProjetoRepositoryMemoria implements IProjetoRepository {
    private readonly projetos = new Map<string, Projeto>();

    public async salvar(projeto: Projeto): Promise<void> {
        this.projetos.set(projeto.getId(), projeto);
    }

    public async buscarPorId(id: string): Promise<Projeto | null> {
        return this.projetos.get(id) ?? null;
    }
}
