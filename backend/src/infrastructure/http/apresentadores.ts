import type { ResultadoRecomendacao } from '../../application/observers/SistemaRecomendacao.js';
import type { ResultadoSubstituicao } from '../../application/services/GestaoEquipeService.js';
import type { Convite } from '../../domain/entities/Convite.js';
import type { Equipe } from '../../domain/entities/Equipe.js';
import type { Profissional } from '../../domain/entities/Profissional.js';
import type { Projeto } from '../../domain/entities/Projeto.js';
import type { ProfissionalPontuado, Recomendacao } from '../../domain/entities/Recomendacao.js';

/** Converte entidades de domínio em JSON de resposta (a API não expõe as classes diretamente). */

const arredondar = (valor: number): number => Math.round(valor * 100) / 100;

export function apresentarProfissional(profissional: Profissional) {
    return {
        id: profissional.getId(),
        nome: profissional.getNome(),
        email: profissional.getEmail(),
        especialidades: profissional.getEspecialidades(),
        precoMedio: arredondar(profissional.getPrecoMedio()),
        mediaAvaliacoes: arredondar(profissional.mediaAvaliacoes()),
        totalAvaliacoes: profissional.getAvaliacoes().length,
        localizacao: profissional.getLocalizacao().toString()
    };
}

export function apresentarPontuado(candidato: ProfissionalPontuado) {
    return { ...apresentarProfissional(candidato.profissional), pontuacao: candidato.pontuacao };
}

export function apresentarEquipe(equipe: Equipe) {
    return {
        id: equipe.getId(),
        status: equipe.getStatus(),
        dataFormacao: equipe.getDataFormacao()?.toISOString() ?? null,
        custoTotal: arredondar(equipe.custoTotal()),
        membros: equipe.getMembros().map((m) => ({
            papel: m.getPapel(),
            confirmado: m.getConfirmado(),
            profissional: apresentarProfissional(m.getProfissional())
        }))
    };
}

export function apresentarProjeto(projeto: Projeto) {
    const equipe = projeto.getEquipe();
    return {
        id: projeto.getId(),
        titulo: projeto.getTitulo(),
        produtor: projeto.getProdutor(),
        genero: projeto.getGenero(),
        duracao: projeto.getDuracao(),
        orcamento: projeto.getOrcamento(),
        prazo: projeto.getPrazo().toISOString(),
        tipoCaptacao: projeto.getTipoCaptacao(),
        localizacao: {
            cidade: projeto.getLocalizacao().getCidade(),
            uf: projeto.getLocalizacao().getUf()
        },
        papeisObrigatorios: projeto.getPapeisObrigatorios().map((r) => ({ papel: r.getPapel(), peso: r.getPeso() })),
        estrategia: projeto.getEstrategia(),
        profissionaisRejeitados: [...projeto.getProfissionaisRejeitados()],
        equipe: equipe ? apresentarEquipe(equipe) : null
    };
}

export function apresentarRecomendacao(recomendacao: Recomendacao) {
    return {
        id: recomendacao.getId(),
        estrategia: recomendacao.getEstrategia(),
        parcial: recomendacao.isParcial(),
        papeisSemCandidatos: recomendacao.getPapeisSemCandidatos(),
        geradaEm: recomendacao.getGeradaEm().toISOString(),
        ranking: Object.fromEntries(
            recomendacao.getPapeis().map((papel) => [papel, recomendacao.getCandidatos(papel).map(apresentarPontuado)])
        )
    };
}

export function apresentarResultadoRecomendacao(projeto: Projeto, resultado: ResultadoRecomendacao) {
    return {
        projeto: apresentarProjeto(projeto),
        equipeRecomendada: resultado.sugestoes[0] ? apresentarEquipe(resultado.sugestoes[0]) : null,
        sugestoes: resultado.sugestoes.map(apresentarEquipe),
        recomendacao: apresentarRecomendacao(resultado.recomendacao),
        parcial: resultado.parcial,
        origemDados: resultado.origemDados
    };
}

export function apresentarSubstituicao(resultado: ResultadoSubstituicao) {
    return {
        papel: resultado.papel,
        novoMembro: resultado.membro ? apresentarProfissional(resultado.membro) : null,
        alternativas: resultado.alternativas.map(apresentarPontuado),
        parcial: resultado.parcial,
        projeto: apresentarProjeto(resultado.projeto)
    };
}

export function apresentarConvite(convite: Convite) {
    return {
        id: convite.getId(),
        projetoId: convite.getProjetoId(),
        papel: convite.getPapel(),
        status: convite.getStatus(),
        criadoEm: convite.getCriadoEm().toISOString(),
        respondidoEm: convite.getRespondidoEm()?.toISOString() ?? null,
        profissional: apresentarProfissional(convite.getProfissional())
    };
}
