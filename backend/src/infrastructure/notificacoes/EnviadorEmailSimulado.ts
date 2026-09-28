import type { IEnviadorEmail, MensagemEmail } from '../../application/ports/ICanaisNotificacao.js';
import type { ILogger } from '../../application/ports/ILogger.js';

/** Simula o envio de e-mails: registra no log e guarda a caixa de saída. */
export class EnviadorEmailSimulado implements IEnviadorEmail {
    private readonly enviados: MensagemEmail[] = [];
    private readonly logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    public async enviar(mensagem: MensagemEmail): Promise<void> {
        this.enviados.push(mensagem);
        this.logger.info('E-mail enviado', { para: mensagem.para, assunto: mensagem.assunto });
    }

    public getEnviados(): readonly MensagemEmail[] {
        return this.enviados;
    }
}
