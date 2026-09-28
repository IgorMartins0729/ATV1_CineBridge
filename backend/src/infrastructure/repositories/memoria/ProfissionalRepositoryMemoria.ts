import type { FiltroCandidatos, IProfissionalRepository } from '../../../application/ports/IProfissionalRepository.js';
import type { Profissional } from '../../../domain/entities/Profissional.js';

export class ProfissionalRepositoryMemoria implements IProfissionalRepository {
    private readonly profissionais = new Map<string, Profissional>();

    constructor(iniciais: readonly Profissional[] = []) {
        for (const profissional of iniciais) {
            this.profissionais.set(profissional.getId(), profissional);
        }
    }

    public async listarTodos(): Promise<Profissional[]> {
        return [...this.profissionais.values()];
    }

    public async buscarPorId(id: string): Promise<Profissional | null> {
        return this.profissionais.get(id) ?? null;
    }

    public async buscarCandidatos(filtro: FiltroCandidatos): Promise<Profissional[]> {
        const excluidos = new Set(filtro.excluirIds ?? []);
        const papeis = new Set(filtro.papeis);
        const resultado: Profissional[] = [];
        for (const profissional of this.profissionais.values()) {
            if (excluidos.has(profissional.getId())) continue;
            if (!profissional.getEspecialidades().some((papel) => papeis.has(papel))) continue;
            if (filtro.disponivelEm && !profissional.estaDisponivelEm(filtro.disponivelEm)) continue;
            if (filtro.precoMaximo !== undefined && profissional.getPrecoMedio() > filtro.precoMaximo) continue;
            resultado.push(profissional);
        }
        return resultado;
    }

    public async salvar(profissional: Profissional): Promise<void> {
        this.profissionais.set(profissional.getId(), profissional);
    }

    public async contar(): Promise<number> {
        return this.profissionais.size;
    }
}
