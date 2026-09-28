import type { Recomendacao } from '../../domain/entities/Recomendacao.js';

export interface IRecomendacaoRepository {
    salvar(recomendacao: Recomendacao): Promise<void>;

    listarPorProjeto(projetoId: string): Promise<Recomendacao[]>;
}
