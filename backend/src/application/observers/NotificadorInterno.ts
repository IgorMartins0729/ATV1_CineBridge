import { rotuloPapel } from '../../domain/enums/Papel.js';
import { TipoEvento, type Evento } from '../eventos/EventoRecomendacao.js';
import type { ICaixaMensagens, MensagemInterna } from '../ports/ICanaisNotificacao.js';
import type { Observador } from './Observador.js';

/** Entrega mensagens na caixa interna da plataforma. */
export class NotificadorInterno implements Observador {
    readonly nome = 'NotificadorInterno';
    private readonly caixa: ICaixaMensagens;

    constructor(caixa: ICaixaMensagens) {
        this.caixa = caixa;
    }

    public async atualizar(evento: Evento): Promise<void> {
        const criadaEm = evento.ocorridoEm;
        const mensagens = this.montarMensagens(evento).map((m) => ({ ...m, criadaEm }));
        await Promise.all(mensagens.map((m) => this.caixa.entregar(m)));
    }

    private montarMensagens(evento: Evento): Array<Omit<MensagemInterna, 'criadaEm'>> {
        switch (evento.tipo) {
            case TipoEvento.RECOMENDACAO_GERADA:
                return evento.dados.recomendados.map((r) => ({
                    destinatarioId: r.id,
                    titulo: 'Novo interesse de produtor',
                    texto: `Você foi recomendado(a) para ${rotuloPapel(r.papel)} em "${evento.dados.titulo}".`
                }));
            case TipoEvento.CONVITE_ENVIADO:
                return [
                    {
                        destinatarioId: evento.dados.profissional.id,
                        titulo: 'Novo convite',
                        texto: `Convite para ${rotuloPapel(evento.dados.papel)} em "${evento.dados.titulo}".`
                    }
                ];
            case TipoEvento.CONVITE_ACEITO:
            case TipoEvento.CONVITE_RECUSADO:
                return [
                    {
                        destinatarioId: evento.dados.produtor.id,
                        titulo: evento.tipo === TipoEvento.CONVITE_ACEITO ? 'Convite aceito' : 'Convite recusado',
                        texto: `${evento.dados.profissional.nome} respondeu ao convite para ${rotuloPapel(evento.dados.papel)}.`
                    }
                ];
            case TipoEvento.EQUIPE_FORMADA:
                return [evento.dados.produtor.id, ...evento.dados.membros.map((m) => m.id)].map((id) => ({
                    destinatarioId: id,
                    titulo: 'Equipe formada',
                    texto: `A equipe de "${evento.dados.titulo}" está completa.`
                }));
            default:
                return [];
        }
    }
}
