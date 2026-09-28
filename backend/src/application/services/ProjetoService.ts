import { Projeto } from '../../domain/entities/Projeto.js';
import type { Papel } from '../../domain/enums/Papel.js';
import type { TipoCaptacao } from '../../domain/enums/TipoCaptacao.js';
import { NaoEncontradoError } from '../../domain/erros.js';
import { Localizacao } from '../../domain/value-objects/Localizacao.js';
import type { Produtor } from '../../domain/value-objects/Produtor.js';
import { RequisitoPapel } from '../../domain/value-objects/RequisitoPapel.js';
import type { IProjetoRepository } from '../ports/IProjetoRepository.js';
import type { RegistroEstrategias } from '../strategies/RegistroEstrategias.js';

export interface NovoProjeto {
    titulo: string;
    produtor: Produtor;
    genero: string;
    duracao: number;
    orcamento: number;
    prazo: Date;
    tipoCaptacao: TipoCaptacao;
    localizacao: { cidade: string; uf: string };
    papeisObrigatorios: Array<{ papel: Papel; peso: number }>;
    estrategia?: string | null | undefined;
}

export class ProjetoService {
    private readonly projetos: IProjetoRepository;
    private readonly estrategias: RegistroEstrategias;

    constructor(deps: { projetos: IProjetoRepository; estrategias: RegistroEstrategias }) {
        this.projetos = deps.projetos;
        this.estrategias = deps.estrategias;
    }

    public async criar(dados: NovoProjeto): Promise<Projeto> {
        if (dados.estrategia) {
            this.estrategias.obter(dados.estrategia);
        }
        const projeto = new Projeto({
            titulo: dados.titulo,
            produtor: dados.produtor,
            genero: dados.genero,
            duracao: dados.duracao,
            orcamento: dados.orcamento,
            prazo: dados.prazo,
            tipoCaptacao: dados.tipoCaptacao,
            localizacao: new Localizacao(dados.localizacao.cidade, dados.localizacao.uf),
            papeisObrigatorios: dados.papeisObrigatorios.map((r) => new RequisitoPapel(r.papel, r.peso)),
            estrategia: dados.estrategia ?? null
        });
        await this.projetos.salvar(projeto);
        return projeto;
    }

    public async buscar(id: string): Promise<Projeto> {
        const projeto = await this.projetos.buscarPorId(id);
        if (!projeto) {
            throw new NaoEncontradoError(`Projeto ${id} não encontrado`);
        }
        return projeto;
    }
}
