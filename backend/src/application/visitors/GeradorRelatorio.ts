import type { Profissional } from '../../domain/entities/Profissional.js';
import type { Projeto } from '../../domain/entities/Projeto.js';
import { rotuloPapel } from '../../domain/enums/Papel.js';
import type { VisitanteProjeto } from '../../domain/visitors/VisitanteProjeto.js';
import { CalculadorCompatibilidade } from './CalculadorCompatibilidade.js';
import { formatarData, formatarMoeda } from './formatacao.js';
import { ValidadorConsistencia } from './ValidadorConsistencia.js';

/** Visitante que gera um relatório em texto para o produtor. Reaproveita os outros dois visitantes. */
export class GeradorRelatorio implements VisitanteProjeto<string> {
    public visitarProjeto(projeto: Projeto): string {
        const equipe = projeto.getEquipe();
        const linhas = [
            `RELATÓRIO DO PROJETO: ${projeto.getTitulo()}`,
            `Produtor(a): ${projeto.getProdutor().nome} <${projeto.getProdutor().email}>`,
            `Gênero: ${projeto.getGenero()} | Captação: ${projeto.getTipoCaptacao()} | Duração: ${projeto.getDuracao()} min`,
            `Orçamento: ${formatarMoeda(projeto.getOrcamento())} | Entrega: ${formatarData(projeto.getPrazo())} | Local: ${projeto.getLocalizacao().toString()}`,
            `Estratégia: ${projeto.getEstrategia() ?? 'automática'}`,
            '',
            `EQUIPE (${equipe ? equipe.getStatus() : 'sem equipe'})`
        ];

        for (const requisito of projeto.getPapeisObrigatorios()) {
            const membro = equipe?.obterMembro(requisito.getPapel());
            const cabecalho = `- ${rotuloPapel(requisito.getPapel())} (peso ${requisito.getPeso()}): `;
            if (!membro) {
                linhas.push(`${cabecalho}VAGO`);
                continue;
            }
            const situacao = membro.getConfirmado() ? 'confirmado' : 'aguardando confirmação';
            linhas.push(`${cabecalho}${membro.getProfissional().aceitar(this)} [${situacao}]`);
        }

        const validador = new ValidadorConsistencia();
        const consistente = projeto.aceitar(validador);
        linhas.push(
            '',
            `Custo total: ${formatarMoeda(equipe?.custoTotal() ?? 0)}`,
            `Compatibilidade geral: ${projeto.aceitar(new CalculadorCompatibilidade())}/100`,
            `Consistência: ${consistente ? 'OK' : 'com problemas'}`,
            ...validador.getProblemas().map((problema) => `  ! ${problema}`)
        );
        return linhas.join('\n');
    }

    public visitarProfissional(profissional: Profissional): string {
        const competencias = [...profissional.getCompetencias()]
            .sort((a, b) => b.getNivel() - a.getNivel())
            .slice(0, 3)
            .map((c) => `${c.getNome()} ${c.getNivel()}`)
            .join(', ');
        return (
            `${profissional.getNome()} (${profissional.getLocalizacao().toString()}) · ` +
            `${formatarMoeda(profissional.getPrecoMedio())} · ` +
            `avaliação ${profissional.mediaAvaliacoes().toFixed(1)}/5 (${profissional.getAvaliacoes().length}) · ` +
            `principais competências: ${competencias || 'nenhuma'}`
        );
    }
}
