import type { IRecomendacaoRepository } from '../../../application/ports/IRecomendacaoRepository.js';
import type { Recomendacao } from '../../../domain/entities/Recomendacao.js';

export class RecomendacaoRepositoryMemoria implements IRecomendacaoRepository {
    private readonly recomendacoes: Recomendacao[] = [];

    public async salvar(recomendacao: Recomendacao): Promise<void> {
        this.recomendacoes.push(recomendacao);
    }

    public async listarPorProjeto(projetoId: string): Promise<Recomendacao[]> {
        return this.recomendacoes.filter((r) => r.getProjetoId() === projetoId);
    }
}
