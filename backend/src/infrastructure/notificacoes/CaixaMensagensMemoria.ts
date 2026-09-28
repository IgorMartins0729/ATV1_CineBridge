import type { ICaixaMensagens, MensagemInterna } from '../../application/ports/ICanaisNotificacao.js';

export class CaixaMensagensMemoria implements ICaixaMensagens {
    private readonly mensagens: MensagemInterna[] = [];

    public async entregar(mensagem: MensagemInterna): Promise<void> {
        this.mensagens.push(mensagem);
    }

    public async listar(destinatarioId: string): Promise<MensagemInterna[]> {
        return this.mensagens.filter((m) => m.destinatarioId === destinatarioId);
    }
}
