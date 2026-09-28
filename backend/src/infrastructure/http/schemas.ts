import { Papel } from '../../domain/enums/Papel.js';
import { TipoCaptacao } from '../../domain/enums/TipoCaptacao.js';

/** JSON Schemas usados pelo Fastify para validar a entrada antes de chegar aos controllers. */

const data = { type: 'string', anyOf: [{ format: 'date' }, { format: 'date-time' }] } as const;
const papel = { type: 'string', enum: Object.values(Papel) } as const;

export const schemaNovoProjeto = {
    body: {
        type: 'object',
        additionalProperties: false,
        required: [
            'titulo',
            'produtor',
            'genero',
            'duracao',
            'orcamento',
            'prazo',
            'tipoCaptacao',
            'localizacao',
            'papeisObrigatorios'
        ],
        properties: {
            titulo: { type: 'string', minLength: 1, maxLength: 200 },
            produtor: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'nome', 'email'],
                properties: {
                    id: { type: 'string', minLength: 1 },
                    nome: { type: 'string', minLength: 1 },
                    email: { type: 'string', format: 'email' }
                }
            },
            genero: { type: 'string', minLength: 1 },
            duracao: { type: 'number', exclusiveMinimum: 0 },
            orcamento: { type: 'number', exclusiveMinimum: 0 },
            prazo: data,
            tipoCaptacao: { type: 'string', enum: Object.values(TipoCaptacao) },
            localizacao: {
                type: 'object',
                additionalProperties: false,
                required: ['cidade', 'uf'],
                properties: {
                    cidade: { type: 'string', minLength: 1 },
                    uf: { type: 'string', pattern: '^[A-Za-z]{2}$' }
                }
            },
            papeisObrigatorios: {
                type: 'array',
                minItems: 1,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['papel', 'peso'],
                    properties: { papel, peso: { type: 'number', exclusiveMinimum: 0 } }
                }
            },
            estrategia: { type: 'string', minLength: 1 }
        }
    }
} as const;

export interface CorpoNovoProjeto {
    titulo: string;
    produtor: { id: string; nome: string; email: string };
    genero: string;
    duracao: number;
    orcamento: number;
    prazo: string;
    tipoCaptacao: TipoCaptacao;
    localizacao: { cidade: string; uf: string };
    papeisObrigatorios: Array<{ papel: Papel; peso: number }>;
    estrategia?: string;
}

const paramsProjeto = {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', minLength: 1 } }
} as const;

const paramsMembro = {
    type: 'object',
    required: ['id', 'papel'],
    properties: { id: { type: 'string', minLength: 1 }, papel }
} as const;

export const schemaProjetoPorId = { params: paramsProjeto } as const;

export const schemaNovaRecomendacao = {
    params: paramsProjeto,
    body: {
        type: ['object', 'null'],
        additionalProperties: false,
        properties: { estrategia: { type: 'string', minLength: 1 } }
    }
} as const;

export const schemaMembro = { params: paramsMembro } as const;

export const schemaSubstituicao = {
    params: paramsMembro,
    body: {
        type: ['object', 'null'],
        additionalProperties: false,
        properties: { profissionalId: { type: 'string', minLength: 1 } }
    }
} as const;

export const schemaRestricoes = {
    params: paramsProjeto,
    body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
            orcamento: { type: 'number', exclusiveMinimum: 0 },
            prazo: data,
            forcarReavaliacao: { type: 'boolean' }
        }
    }
} as const;

export const schemaConvitePorId = {
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1 } } }
} as const;

export const schemaRespostaConvite = {
    params: schemaConvitePorId.params,
    body: {
        type: 'object',
        additionalProperties: false,
        required: ['aceito'],
        properties: { aceito: { type: 'boolean' } }
    }
} as const;
