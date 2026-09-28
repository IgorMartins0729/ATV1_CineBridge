import { randomUUID } from 'node:crypto';
import { ConflitoError, NaoEncontradoError } from '../erros.js';
import type { Papel } from '../enums/Papel.js';
import { StatusEquipe } from '../enums/StatusEquipe.js';
import { MembroEquipe } from './MembroEquipe.js';
import type { Profissional } from './Profissional.js';

export class Equipe {
    private readonly id: string;
    private dataFormacao: Date | null;
    private status: StatusEquipe;
    private readonly membros: Map<Papel, MembroEquipe>;

    constructor(
        id: string = randomUUID(),
        membros: MembroEquipe[] = [],
        status: StatusEquipe = StatusEquipe.EM_FORMACAO,
        dataFormacao: Date | null = null
    ) {
        this.id = id;
        this.status = status;
        this.dataFormacao = dataFormacao;
        this.membros = new Map();
        for (const membro of membros) {
            this.garantirSemRepeticao(membro.getPapel(), membro.getProfissional());
            this.membros.set(membro.getPapel(), membro);
        }
    }

    public getId(): string {
        return this.id;
    }

    public getDataFormacao(): Date | null {
        return this.dataFormacao ? new Date(this.dataFormacao) : null;
    }

    public getStatus(): StatusEquipe {
        return this.status;
    }

    public getMembros(): readonly MembroEquipe[] {
        return [...this.membros.values()];
    }

    public obterMembro(papel: Papel): MembroEquipe | null {
        return this.membros.get(papel) ?? null;
    }

    public possuiProfissional(profissionalId: string): boolean {
        return this.getMembros().some((m) => m.getProfissional().getId() === profissionalId);
    }

    /** Coloca o profissional no papel, substituindo quem estava lá. Retorna o membro anterior. */
    public definirMembro(papel: Papel, profissional: Profissional): MembroEquipe | null {
        this.garantirEmFormacao();
        this.garantirSemRepeticao(papel, profissional);
        const anterior = this.obterMembro(papel);
        this.membros.set(papel, new MembroEquipe(papel, profissional));
        return anterior;
    }

    public removerMembro(papel: Papel): MembroEquipe | null {
        this.garantirEmFormacao();
        const anterior = this.obterMembro(papel);
        this.membros.delete(papel);
        return anterior;
    }

    public confirmarMembro(papel: Papel, profissionalId: string): void {
        this.garantirEmFormacao();
        const membro = this.obterMembro(papel);
        if (!membro || membro.getProfissional().getId() !== profissionalId) {
            throw new NaoEncontradoError(`Profissional ${profissionalId} não ocupa o papel ${papel} nesta equipe`);
        }
        membro.confirmar();
    }

    public estaCompleta(papeisObrigatorios: readonly Papel[]): boolean {
        return papeisObrigatorios.every((papel) => this.membros.has(papel));
    }

    public todosConfirmados(papeisObrigatorios: readonly Papel[]): boolean {
        return papeisObrigatorios.every((papel) => this.membros.get(papel)?.getConfirmado() === true);
    }

    public custoTotal(): number {
        return this.getMembros().reduce((total, m) => total + m.getProfissional().getPrecoMedio(), 0);
    }

    public estaFormada(): boolean {
        return this.status === StatusEquipe.FORMADA;
    }

    /** Registra a composição final. Só é possível com todos os papéis preenchidos e confirmados. */
    public formar(papeisObrigatorios: readonly Papel[], agora: Date = new Date()): void {
        this.garantirEmFormacao();
        if (!this.todosConfirmados(papeisObrigatorios)) {
            throw new ConflitoError('A equipe só pode ser formada quando todos os papéis estiverem confirmados');
        }
        this.status = StatusEquipe.FORMADA;
        this.dataFormacao = new Date(agora);
    }

    private garantirEmFormacao(): void {
        if (this.estaFormada()) {
            throw new ConflitoError('A equipe já foi formada e não pode mais ser alterada');
        }
    }

    private garantirSemRepeticao(papel: Papel, profissional: Profissional): void {
        const repetido = [...this.membros.values()].find(
            (m) => m.getPapel() !== papel && m.getProfissional().getId() === profissional.getId()
        );
        if (repetido) {
            throw new ConflitoError(
                `${profissional.getNome()} já ocupa o papel ${repetido.getPapel()} nesta equipe`
            );
        }
    }
}
