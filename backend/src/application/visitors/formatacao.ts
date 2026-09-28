const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarMoeda(valor: number): string {
    return moeda.format(valor).replace(/ /g, ' ');
}

export function formatarData(data: Date): string {
    return data.toISOString().slice(0, 10);
}
