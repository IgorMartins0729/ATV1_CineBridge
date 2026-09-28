import { Papel } from '../enums/Papel.js';
import { TipoCaptacao } from '../enums/TipoCaptacao.js';

/** Competência técnica -> nível ideal (0 a 10). */
export type PerfilCompetencias = Readonly<Record<string, number>>;

/** Perfil técnico ideal esperado de cada papel. Base do vetor de competências. */
export const PERFIS_POR_PAPEL: Readonly<Record<Papel, PerfilCompetencias>> = {
    [Papel.DIRETOR]: { direcao: 10, roteiro: 6, fotografia: 5, montagem: 4 },
    [Papel.DIRETOR_FOTOGRAFIA]: { fotografia: 10, iluminacao: 9, direcao: 4, efeitos: 3 },
    [Papel.SONOPLASTA]: { audio: 10, mixagem: 9, montagem: 3 },
    [Papel.EDITOR]: { montagem: 10, colorizacao: 7, audio: 4, efeitos: 4 },
    [Papel.ROTEIRISTA]: { roteiro: 10, pesquisa: 7, direcao: 4 },
    [Papel.EFEITOS_VISUAIS]: { efeitos: 10, animacao3d: 8, colorizacao: 5, montagem: 3 }
};

/** Competência de linguagem associada a cada tipo de captação. */
export const COMPETENCIA_POR_CAPTACAO: Readonly<Record<TipoCaptacao, string>> = {
    [TipoCaptacao.DOCUMENTARIO]: 'documentario',
    [TipoCaptacao.FICCAO]: 'ficcao',
    [TipoCaptacao.ANIMACAO]: 'animacao'
};
