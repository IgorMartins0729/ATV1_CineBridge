export enum Papel {
    DIRETOR = 'DIRETOR',
    DIRETOR_FOTOGRAFIA = 'DIRETOR_FOTOGRAFIA',
    SONOPLASTA = 'SONOPLASTA',
    EDITOR = 'EDITOR',
    ROTEIRISTA = 'ROTEIRISTA',
    EFEITOS_VISUAIS = 'EFEITOS_VISUAIS'
}

const ROTULOS: Record<Papel, string> = {
    [Papel.DIRETOR]: 'Direção',
    [Papel.DIRETOR_FOTOGRAFIA]: 'Direção de fotografia',
    [Papel.SONOPLASTA]: 'Sonoplastia',
    [Papel.EDITOR]: 'Edição',
    [Papel.ROTEIRISTA]: 'Roteiro',
    [Papel.EFEITOS_VISUAIS]: 'Efeitos visuais'
};

export function rotuloPapel(papel: Papel): string {
    return ROTULOS[papel];
}
