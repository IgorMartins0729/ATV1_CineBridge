import type { Profissional } from '../../domain/entities/Profissional.js';
import type { ProfissionalPontuado, Ranking } from '../../domain/entities/Recomendacao.js';
import type { Papel } from '../../domain/enums/Papel.js';

/** Retorna a pontuação (0 a 1) ou null quando o profissional não serve para o papel. */
export type FuncaoPontuacao = (profissional: Profissional, papel: Papel) => number | null;

export function limitar01(valor: number): number {
    return Math.max(0, Math.min(1, valor));
}

/** Ordem do ranking: maior pontuação; empate -> menor preço; depois id (resultado estável). */
function vemAntes(a: ProfissionalPontuado, b: ProfissionalPontuado): boolean {
    if (a.pontuacao !== b.pontuacao) return a.pontuacao > b.pontuacao;
    const precoA = a.profissional.getPrecoMedio();
    const precoB = b.profissional.getPrecoMedio();
    if (precoA !== precoB) return precoA < precoB;
    return a.profissional.getId() < b.profissional.getId();
}

/** Mantém apenas os `limite` melhores (inserção ordenada): O(n x topN) em vez de ordenar a lista toda. */
function inserirNoTopo(topo: ProfissionalPontuado[], candidato: ProfissionalPontuado, limite: number): void {
    const ultimo = topo[topo.length - 1];
    if (topo.length >= limite && ultimo && !vemAntes(candidato, ultimo)) return;
    let i = topo.length;
    while (i > 0 && vemAntes(candidato, topo[i - 1]!)) i--;
    topo.splice(i, 0, candidato);
    if (topo.length > limite) topo.pop();
}

/**
 * Parte comum às estratégias: para cada papel, considera só quem tem a especialidade,
 * pontua e mantém os topN melhores.
 */
export function rankearPorPapel(
    profissionais: readonly Profissional[],
    papeis: readonly Papel[],
    topN: number,
    pontuar: FuncaoPontuacao
): Ranking {
    const ranking: Ranking = new Map(papeis.map((papel) => [papel, [] as ProfissionalPontuado[]]));
    // Uma única passada: cada profissional só é pontuado nos papéis em que é especialista.
    for (const profissional of profissionais) {
        for (const papel of profissional.getEspecialidades()) {
            const topo = ranking.get(papel);
            if (!topo) continue;
            const pontuacao = pontuar(profissional, papel);
            if (pontuacao === null) continue;
            inserirNoTopo(topo, { profissional, pontuacao: Math.round(limitar01(pontuacao) * 10_000) / 10_000 }, topN);
        }
    }
    return ranking;
}
