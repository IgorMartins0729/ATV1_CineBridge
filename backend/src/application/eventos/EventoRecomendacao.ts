import type { Papel } from '../../domain/enums/Papel.js';
import type { Produtor } from '../../domain/value-objects/Produtor.js';

export enum TipoEvento {
    RECOMENDACAO_GERADA = 'RECOMENDACAO_GERADA',
    CONVITE_ENVIADO = 'CONVITE_ENVIADO',
    CONVITE_ACEITO = 'CONVITE_ACEITO',
    CONVITE_RECUSADO = 'CONVITE_RECUSADO',
    MEMBRO_SUBSTITUIDO = 'MEMBRO_SUBSTITUIDO',
    REAVALIACAO_SOLICITADA = 'REAVALIACAO_SOLICITADA',
    EQUIPE_FORMADA = 'EQUIPE_FORMADA'
}

/** Resumo serializável de um profissional (eventos precisam poder ir para uma fila no futuro). */
export interface ResumoProfissional {
    id: string;
    nome: string;
    email: string;
    papel: Papel;
}

export interface DadosConvite {
    conviteId: string;
    projetoId: string;
    titulo: string;
    produtor: Produtor;
    papel: Papel;
    profissional: ResumoProfissional;
}

/** Formato dos dados de cada tipo de evento. Tudo em tipos primitivos/JSON. */
export interface DadosEvento {
    [TipoEvento.RECOMENDACAO_GERADA]: {
        recomendacaoId: string;
        projetoId: string;
        titulo: string;
        produtor: Produtor;
        estrategia: string;
        parcial: boolean;
        papeis: Papel[];
        recomendados: ResumoProfissional[];
    };
    [TipoEvento.CONVITE_ENVIADO]: DadosConvite;
    [TipoEvento.CONVITE_ACEITO]: DadosConvite;
    [TipoEvento.CONVITE_RECUSADO]: DadosConvite;
    [TipoEvento.MEMBRO_SUBSTITUIDO]: {
        projetoId: string;
        papel: Papel;
        motivo: 'SUBSTITUICAO' | 'REJEICAO' | 'RECUSA_CONVITE';
        anteriorId: string | null;
        novo: ResumoProfissional | null;
    };
    [TipoEvento.REAVALIACAO_SOLICITADA]: {
        projetoId: string;
        motivo: string;
        orcamentoAnterior: number;
        orcamentoNovo: number;
        prazoAnterior: string;
        prazoNovo: string;
    };
    [TipoEvento.EQUIPE_FORMADA]: {
        projetoId: string;
        titulo: string;
        produtor: Produtor;
        equipeId: string;
        orcamento: number;
        custoTotal: number;
        dataFormacao: string;
        membros: Array<ResumoProfissional & { precoMedio: number }>;
    };
}

/** Evento publicado pelo sujeito (SistemaRecomendacao) e recebido pelos observadores. */
export class EventoRecomendacao<T extends TipoEvento = TipoEvento> {
    readonly tipo: T;
    readonly dados: DadosEvento[T];
    readonly origem: string;
    readonly ocorridoEm: Date;

    constructor(tipo: T, dados: DadosEvento[T], origem: string, ocorridoEm: Date = new Date()) {
        this.tipo = tipo;
        this.dados = dados;
        this.origem = origem;
        this.ocorridoEm = new Date(ocorridoEm);
    }
}

/** União discriminada de todos os eventos: `switch (evento.tipo)` já tipa `evento.dados`. */
export type Evento = { [K in TipoEvento]: EventoRecomendacao<K> }[TipoEvento];

export function criarEvento<T extends TipoEvento>(tipo: T, dados: DadosEvento[T], origem: string): Evento {
    return new EventoRecomendacao(tipo, dados, origem) as unknown as Evento;
}
