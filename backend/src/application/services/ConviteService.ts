import type { Convite } from '../../domain/entities/Convite.js';
import { NaoEncontradoError } from '../../domain/erros.js';
import { criarEvento, TipoEvento } from '../eventos/EventoRecomendacao.js';
import type { SistemaRecomendacao } from '../observers/SistemaRecomendacao.js';
import type { IConviteRepository } from '../ports/IConviteRepository.js';
import type { IProjetoRepository } from '../ports/IProjetoRepository.js';
import { dadosDoConvite } from './resumos.js';

/** Ações do profissional: responder ao convite. A reação na equipe fica com os observadores. */
export class ConviteService {
    private readonly convites: IConviteRepository;
    private readonly projetos: IProjetoRepository;
    private readonly sistema: SistemaRecomendacao;

    constructor(deps: { convites: IConviteRepository; projetos: IProjetoRepository; sistema: SistemaRecomendacao }) {
        this.convites = deps.convites;
        this.projetos = deps.projetos;
        this.sistema = deps.sistema;
    }

    public async buscar(conviteId: string): Promise<Convite> {
        const convite = await this.convites.buscarPorId(conviteId);
        if (!convite) {
            throw new NaoEncontradoError(`Convite ${conviteId} não encontrado`);
        }
        return convite;
    }

    public async responder(conviteId: string, aceito: boolean): Promise<Convite> {
        const convite = await this.buscar(conviteId);
        const projeto = await this.projetos.buscarPorId(convite.getProjetoId());
        if (!projeto) {
            throw new NaoEncontradoError(`Projeto ${convite.getProjetoId()} não encontrado`);
        }

        if (aceito) {
            convite.aceitar();
        } else {
            convite.recusar();
        }
        await this.convites.salvar(convite);

        const tipo = aceito ? TipoEvento.CONVITE_ACEITO : TipoEvento.CONVITE_RECUSADO;
        await this.sistema.notificarObservadores(criarEvento(tipo, dadosDoConvite(convite, projeto), 'ConviteService'));
        return convite;
    }
}
