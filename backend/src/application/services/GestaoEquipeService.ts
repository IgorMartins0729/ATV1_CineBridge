import { Convite } from '../../domain/entities/Convite.js';
import type { Profissional } from '../../domain/entities/Profissional.js';
import type { Projeto } from '../../domain/entities/Projeto.js';
import type { ProfissionalPontuado } from '../../domain/entities/Recomendacao.js';
import { rotuloPapel, type Papel } from '../../domain/enums/Papel.js';
import { ConflitoError, NaoEncontradoError, ValidacaoError } from '../../domain/erros.js';
import { criarEvento, TipoEvento } from '../eventos/EventoRecomendacao.js';
import type { ReacoesConvite } from '../observers/AtualizadorComposicaoEquipe.js';
import type { ResultadoRecomendacao, SistemaRecomendacao } from '../observers/SistemaRecomendacao.js';
import type { IConviteRepository } from '../ports/IConviteRepository.js';
import type { IProjetoRepository } from '../ports/IProjetoRepository.js';
import { dadosDoConvite, resumirProfissional } from './resumos.js';

export interface ConfigReavaliacao {
    /** Variação relativa do orçamento considerada significativa (0,2 = 20%). */
    limiarOrcamento: number;
    /** Variação do prazo, em dias, considerada significativa. */
    limiarPrazoDias: number;
}

export const CONFIG_REAVALIACAO_PADRAO: ConfigReavaliacao = { limiarOrcamento: 0.2, limiarPrazoDias: 15 };

export interface DependenciasGestao {
    projetos: IProjetoRepository;
    convites: IConviteRepository;
    sistema: SistemaRecomendacao;
    config?: Partial<ConfigReavaliacao>;
}

export interface ResultadoSubstituicao {
    projeto: Projeto;
    papel: Papel;
    membro: Profissional | null;
    alternativas: readonly ProfissionalPontuado[];
    parcial: boolean;
}

export interface AlteracaoRestricoes {
    orcamento?: number | undefined;
    prazo?: Date | undefined;
    forcarReavaliacao?: boolean | undefined;
}

export interface ResultadoAlteracao {
    projeto: Projeto;
    reavaliado: boolean;
    resultado: ResultadoRecomendacao | null;
}

type MotivoTroca = 'SUBSTITUICAO' | 'REJEICAO' | 'RECUSA_CONVITE';

const ORIGEM = 'GestaoEquipeService';
const DIA_MS = 86_400_000;

/** Casos de uso do produtor sobre a equipe: recomendar, aceitar, rejeitar, substituir, reavaliar e formar. */
export class GestaoEquipeService implements ReacoesConvite {
    private readonly projetos: IProjetoRepository;
    private readonly convites: IConviteRepository;
    private readonly sistema: SistemaRecomendacao;
    private readonly config: ConfigReavaliacao;

    constructor(deps: DependenciasGestao) {
        this.projetos = deps.projetos;
        this.convites = deps.convites;
        this.sistema = deps.sistema;
        this.config = { ...CONFIG_REAVALIACAO_PADRAO, ...deps.config };
    }

    /** Recomendação completa: gera sugestões e adota a melhor como equipe em formação. */
    public async recomendarEquipe(projetoId: string, estrategia?: string | null): Promise<ResultadoRecomendacao> {
        const projeto = await this.buscarProjeto(projetoId);
        if (projeto.estaFormada()) {
            throw new ConflitoError('A equipe deste projeto já foi formada');
        }
        if (estrategia) {
            projeto.definirEstrategia(this.sistema.obterEstrategia(estrategia).nome);
        }

        const resultado = await this.sistema.executarRecomendacao(projeto, {
            excluidos: projeto.getProfissionaisRejeitados()
        });
        await this.cancelarConvitesPendentes(projeto.getId());
        projeto.solicitarReavaliacao();
        const melhor = resultado.sugestoes[0];
        if (melhor) {
            projeto.definirEquipe(melhor);
        }
        await this.projetos.salvar(projeto);
        return resultado;
    }

    /** O produtor aceita o profissional sugerido: um convite é enviado a ele. */
    public async aceitarMembro(projetoId: string, papel: Papel): Promise<Convite> {
        const projeto = await this.buscarProjeto(projetoId);
        const membro = projeto.getEquipe()?.obterMembro(papel);
        if (!membro) {
            throw new NaoEncontradoError(`Nenhum profissional sugerido para ${rotuloPapel(papel)}`);
        }
        if (membro.getConfirmado()) {
            throw new ConflitoError(`${membro.getProfissional().getNome()} já confirmou participação`);
        }

        const existente = (await this.convites.listarPorProjeto(projetoId)).find(
            (c) =>
                c.estaPendente() && c.getPapel() === papel && c.getProfissional().getId() === membro.getProfissional().getId()
        );
        if (existente) return existente;

        const convite = new Convite({ projetoId, papel, profissional: membro.getProfissional() });
        await this.convites.salvar(convite);
        await this.sistema.notificarObservadores(
            criarEvento(TipoEvento.CONVITE_ENVIADO, dadosDoConvite(convite, projeto), ORIGEM)
        );
        return convite;
    }

    /** Rejeita o sugerido: ele não volta a ser recomendado e uma nova rodada escolhe outro para o papel. */
    public async rejeitarMembro(projetoId: string, papel: Papel): Promise<ResultadoSubstituicao> {
        return this.trocar(await this.buscarProjeto(projetoId), papel, 'REJEICAO');
    }

    /** Substitui o membro do papel (opcionalmente por um candidato específico), mantendo os demais fixos. */
    public async substituirMembro(
        projetoId: string,
        papel: Papel,
        profissionalId?: string
    ): Promise<ResultadoSubstituicao> {
        return this.trocar(await this.buscarProjeto(projetoId), papel, 'SUBSTITUICAO', profissionalId);
    }

    /** Mudança de orçamento/prazo. Se for significativa, a equipe inteira é reavaliada. */
    public async atualizarRestricoes(projetoId: string, alteracao: AlteracaoRestricoes): Promise<ResultadoAlteracao> {
        const projeto = await this.buscarProjeto(projetoId);
        const orcamentoAnterior = projeto.getOrcamento();
        const prazoAnterior = projeto.getPrazo();

        if (alteracao.orcamento !== undefined) projeto.alterarOrcamento(alteracao.orcamento);
        if (alteracao.prazo !== undefined) projeto.alterarPrazo(alteracao.prazo);

        const variacaoOrcamento = Math.abs(projeto.getOrcamento() - orcamentoAnterior) / orcamentoAnterior;
        const variacaoDias = Math.abs(projeto.getPrazo().getTime() - prazoAnterior.getTime()) / DIA_MS;
        const motivos: string[] = [];
        if (alteracao.forcarReavaliacao) motivos.push('solicitada pelo produtor');
        if (variacaoOrcamento >= this.config.limiarOrcamento) {
            motivos.push(`orçamento variou ${Math.round(variacaoOrcamento * 100)}%`);
        }
        if (variacaoDias >= this.config.limiarPrazoDias) motivos.push(`prazo mudou ${Math.round(variacaoDias)} dias`);

        await this.projetos.salvar(projeto);
        if (motivos.length === 0) {
            return { projeto, reavaliado: false, resultado: null };
        }

        await this.sistema.notificarObservadores(
            criarEvento(
                TipoEvento.REAVALIACAO_SOLICITADA,
                {
                    projetoId,
                    motivo: motivos.join('; '),
                    orcamentoAnterior,
                    orcamentoNovo: projeto.getOrcamento(),
                    prazoAnterior: prazoAnterior.toISOString(),
                    prazoNovo: projeto.getPrazo().toISOString()
                },
                ORIGEM
            )
        );
        const resultado = await this.recomendarEquipe(projetoId);
        return { projeto: await this.buscarProjeto(projetoId), reavaliado: true, resultado };
    }

    /** Reação ao convite aceito: confirma o membro e, se todos confirmaram, forma a equipe. */
    public async confirmarPresenca(projetoId: string, papel: Papel, profissionalId: string): Promise<void> {
        const projeto = await this.buscarProjeto(projetoId);
        const equipe = projeto.getEquipe();
        if (!equipe || equipe.estaFormada()) return;

        equipe.confirmarMembro(papel, profissionalId);
        const papeis = projeto.getPapeis();
        const formou = equipe.estaCompleta(papeis) && equipe.todosConfirmados(papeis);
        if (formou) {
            equipe.formar(papeis);
        }
        await this.projetos.salvar(projeto);

        if (formou) {
            await this.sistema.notificarObservadores(
                criarEvento(
                    TipoEvento.EQUIPE_FORMADA,
                    {
                        projetoId,
                        titulo: projeto.getTitulo(),
                        produtor: projeto.getProdutor(),
                        equipeId: equipe.getId(),
                        orcamento: projeto.getOrcamento(),
                        custoTotal: equipe.custoTotal(),
                        dataFormacao: (equipe.getDataFormacao() ?? new Date()).toISOString(),
                        membros: equipe.getMembros().map((m) => ({
                            ...resumirProfissional(m.getProfissional(), m.getPapel()),
                            precoMedio: m.getProfissional().getPrecoMedio()
                        }))
                    },
                    ORIGEM
                )
            );
        }
    }

    /** Reação ao convite recusado: nova rodada de recomendação só para o papel. */
    public async tratarRecusa(projetoId: string, papel: Papel, profissionalId: string): Promise<void> {
        const projeto = await this.buscarProjeto(projetoId);
        const atual = projeto.getEquipe()?.obterMembro(papel);
        if (projeto.estaFormada() || atual?.getProfissional().getId() !== profissionalId) return;
        await this.trocar(projeto, papel, 'RECUSA_CONVITE');
    }

    public async buscarProjeto(projetoId: string): Promise<Projeto> {
        const projeto = await this.projetos.buscarPorId(projetoId);
        if (!projeto) {
            throw new NaoEncontradoError(`Projeto ${projetoId} não encontrado`);
        }
        return projeto;
    }

    public async listarConvites(projetoId: string): Promise<Convite[]> {
        await this.buscarProjeto(projetoId);
        return this.convites.listarPorProjeto(projetoId);
    }

    private async trocar(
        projeto: Projeto,
        papel: Papel,
        motivo: MotivoTroca,
        profissionalId?: string
    ): Promise<ResultadoSubstituicao> {
        if (!projeto.exigePapel(papel)) {
            throw new ValidacaoError(`O papel ${papel} não faz parte deste projeto`);
        }
        const anterior = projeto.rejeitarMembro(papel);
        if (anterior) {
            await this.cancelarConvitesPendentes(projeto.getId(), papel);
        }

        const fixos = new Map<Papel, Profissional>();
        for (const membro of projeto.getEquipe()?.getMembros() ?? []) {
            fixos.set(membro.getPapel(), membro.getProfissional());
        }
        const resultado = await this.sistema.executarRecomendacao(projeto, {
            papeis: [papel],
            excluidos: projeto.getProfissionaisRejeitados(),
            fixos
        });
        const alternativas = resultado.recomendacao.getCandidatos(papel);

        let escolhido: Profissional | null;
        if (profissionalId) {
            escolhido = alternativas.find((c) => c.profissional.getId() === profissionalId)?.profissional ?? null;
            if (!escolhido) {
                throw new ValidacaoError(`Profissional ${profissionalId} não está entre os candidatos recomendados`);
            }
        } else {
            escolhido = resultado.sugestoes[0]?.obterMembro(papel)?.getProfissional() ?? null;
        }

        if (escolhido) {
            projeto.substituirMembro(papel, escolhido);
        }
        await this.projetos.salvar(projeto);

        await this.sistema.notificarObservadores(
            criarEvento(
                TipoEvento.MEMBRO_SUBSTITUIDO,
                {
                    projetoId: projeto.getId(),
                    papel,
                    motivo,
                    anteriorId: anterior?.getProfissional().getId() ?? null,
                    novo: escolhido ? resumirProfissional(escolhido, papel) : null
                },
                ORIGEM
            )
        );
        return { projeto, papel, membro: escolhido, alternativas, parcial: resultado.parcial };
    }

    private async cancelarConvitesPendentes(projetoId: string, papel?: Papel): Promise<void> {
        for (const convite of await this.convites.listarPorProjeto(projetoId)) {
            if (convite.estaPendente() && (papel === undefined || convite.getPapel() === papel)) {
                convite.cancelar();
                await this.convites.salvar(convite);
            }
        }
    }
}
