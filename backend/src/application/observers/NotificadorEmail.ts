import { rotuloPapel } from '../../domain/enums/Papel.js';
import { TipoEvento, type Evento } from '../eventos/EventoRecomendacao.js';
import type { IEnviadorEmail, MensagemEmail } from '../ports/ICanaisNotificacao.js';
import type { Observador } from './Observador.js';

/** Envia e-mails: aos profissionais (interesse/convite) e ao produtor (respostas e equipe formada). */
export class NotificadorEmail implements Observador {
    readonly nome = 'NotificadorEmail';
    private readonly enviador: IEnviadorEmail;

    constructor(enviador: IEnviadorEmail) {
        this.enviador = enviador;
    }

    public async atualizar(evento: Evento): Promise<void> {
        await Promise.all(this.montarMensagens(evento).map((m) => this.enviador.enviar(m)));
    }

    private montarMensagens(evento: Evento): MensagemEmail[] {
        switch (evento.tipo) {
            case TipoEvento.RECOMENDACAO_GERADA: {
                const { produtor, titulo, recomendados } = evento.dados;
                return recomendados.map((r) => ({
                    para: r.email,
                    assunto: 'Um produtor tem interesse no seu perfil',
                    corpo: `${produtor.nome} está montando a equipe de "${titulo}" e você foi recomendado(a) para ${rotuloPapel(r.papel)}.`
                }));
            }
            case TipoEvento.CONVITE_ENVIADO: {
                const { profissional, titulo, papel, produtor } = evento.dados;
                return [
                    {
                        para: profissional.email,
                        assunto: `Convite: ${rotuloPapel(papel)} em "${titulo}"`,
                        corpo: `${produtor.nome} convidou você para ${rotuloPapel(papel)}. Responda pela plataforma CineBridge.`
                    }
                ];
            }
            case TipoEvento.CONVITE_ACEITO:
            case TipoEvento.CONVITE_RECUSADO: {
                const { profissional, titulo, papel, produtor } = evento.dados;
                const acao = evento.tipo === TipoEvento.CONVITE_ACEITO ? 'aceitou' : 'recusou';
                return [
                    {
                        para: produtor.email,
                        assunto: `${profissional.nome} ${acao} o convite`,
                        corpo: `${profissional.nome} ${acao} o convite para ${rotuloPapel(papel)} em "${titulo}".`
                    }
                ];
            }
            case TipoEvento.EQUIPE_FORMADA: {
                const { produtor, titulo, membros } = evento.dados;
                const assunto = `Equipe de "${titulo}" formada`;
                return [
                    { para: produtor.email, assunto, corpo: `Todos os ${membros.length} membros confirmaram.` },
                    ...membros.map((m) => ({
                        para: m.email,
                        assunto,
                        corpo: `A equipe está completa. Você fará ${rotuloPapel(m.papel)}.`
                    }))
                ];
            }
            default:
                return [];
        }
    }
}
