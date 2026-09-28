import { randomUUID } from 'node:crypto';
import { ConflitoError } from '../erros.js';
import type { Papel } from '../enums/Papel.js';
import { StatusConvite } from '../enums/StatusConvite.js';
import type { Profissional } from './Profissional.js';

export interface ConviteProps {
    id?: string;
    projetoId: string;
    papel: Papel;
    profissional: Profissional;
    status?: StatusConvite;
    criadoEm?: Date;
    respondidoEm?: Date | null;
}

/** Convite enviado a um profissional para ocupar um papel no projeto. */
export class Convite {
    private readonly id: string;
    private readonly projetoId: string;
    private readonly papel: Papel;
    private readonly profissional: Profissional;
    private status: StatusConvite;
    private readonly criadoEm: Date;
    private respondidoEm: Date | null;

    constructor(props: ConviteProps) {
        this.id = props.id ?? randomUUID();
        this.projetoId = props.projetoId;
        this.papel = props.papel;
        this.profissional = props.profissional;
        this.status = props.status ?? StatusConvite.PENDENTE;
        this.criadoEm = new Date(props.criadoEm ?? new Date());
        this.respondidoEm = props.respondidoEm ? new Date(props.respondidoEm) : null;
    }

    public getId(): string {
        return this.id;
    }

    public getProjetoId(): string {
        return this.projetoId;
    }

    public getPapel(): Papel {
        return this.papel;
    }

    public getProfissional(): Profissional {
        return this.profissional;
    }

    public getStatus(): StatusConvite {
        return this.status;
    }

    public getCriadoEm(): Date {
        return new Date(this.criadoEm);
    }

    public getRespondidoEm(): Date | null {
        return this.respondidoEm ? new Date(this.respondidoEm) : null;
    }

    public estaPendente(): boolean {
        return this.status === StatusConvite.PENDENTE;
    }

    public aceitar(agora: Date = new Date()): void {
        this.finalizar(StatusConvite.ACEITO, agora);
    }

    public recusar(agora: Date = new Date()): void {
        this.finalizar(StatusConvite.RECUSADO, agora);
    }

    public cancelar(agora: Date = new Date()): void {
        this.finalizar(StatusConvite.CANCELADO, agora);
    }

    private finalizar(novoStatus: StatusConvite, agora: Date): void {
        if (!this.estaPendente()) {
            throw new ConflitoError(`Convite já está ${this.status} e não pode mudar para ${novoStatus}`);
        }
        this.status = novoStatus;
        this.respondidoEm = new Date(agora);
    }
}
