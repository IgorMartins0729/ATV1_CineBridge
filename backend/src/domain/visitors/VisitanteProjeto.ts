import type { Profissional } from '../entities/Profissional.js';
import type { Projeto } from '../entities/Projeto.js';

/**
 * Visitor: operações transversais sobre a árvore Projeto -> Equipe -> Profissional,
 * sem colocar essa lógica dentro das entidades. R é o tipo do resultado da operação.
 */
export interface VisitanteProjeto<R> {
    visitarProjeto(projeto: Projeto): R;
    visitarProfissional(profissional: Profissional): R;
}

/** Elemento que pode ser percorrido por um visitante. */
export interface Visitavel {
    aceitar<R>(visitante: VisitanteProjeto<R>): R;
}
