export interface MensagemEmail {
    para: string;
    assunto: string;
    corpo: string;
}

/** Envio de e-mail (em produção seria SMTP/SES; aqui é simulado). */
export interface IEnviadorEmail {
    enviar(mensagem: MensagemEmail): Promise<void>;
}

export interface MensagemInterna {
    destinatarioId: string;
    titulo: string;
    texto: string;
    criadaEm: Date;
}

/** Caixa de mensagens internas da plataforma. */
export interface ICaixaMensagens {
    entregar(mensagem: MensagemInterna): Promise<void>;
    listar(destinatarioId: string): Promise<MensagemInterna[]>;
}

export interface RegistroAuditoria {
    tipo: string;
    origem: string;
    ocorridoEm: string;
    dados: unknown;
}

/** Armazena o trilho de auditoria (logs estruturados para análise posterior). */
export interface IRegistroAuditoria {
    registrar(registro: RegistroAuditoria): Promise<void>;
    listar(): Promise<RegistroAuditoria[]>;
}
