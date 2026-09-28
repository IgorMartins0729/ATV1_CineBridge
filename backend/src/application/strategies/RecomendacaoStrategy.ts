import type { Profissional } from '../../domain/entities/Profissional.js';
import type { Projeto } from '../../domain/entities/Projeto.js';
import type { Ranking } from '../../domain/entities/Recomendacao.js';
import type { Papel } from '../../domain/enums/Papel.js';

/**
 * Strategy: cada implementação encapsula um algoritmo de recomendação diferente.
 * Recebe o projeto e os candidatos e devolve, por papel, os profissionais ordenados do melhor para o pior.
 */
export interface RecomendacaoStrategy {
    readonly nome: string;
    readonly descricao: string;

    /** @param papeis papéis a recomendar (padrão: todos os papéis obrigatórios do projeto). */
    recomendar(projeto: Projeto, profissionais: readonly Profissional[], papeis?: readonly Papel[]): Ranking;
}
