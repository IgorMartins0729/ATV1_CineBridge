import type { Convite } from '../../domain/entities/Convite.js';
import type { Profissional } from '../../domain/entities/Profissional.js';
import type { Projeto } from '../../domain/entities/Projeto.js';
import type { Papel } from '../../domain/enums/Papel.js';
import type { DadosConvite, ResumoProfissional } from '../eventos/EventoRecomendacao.js';

export function resumirProfissional(profissional: Profissional, papel: Papel): ResumoProfissional {
    return { id: profissional.getId(), nome: profissional.getNome(), email: profissional.getEmail(), papel };
}

export function dadosDoConvite(convite: Convite, projeto: Projeto): DadosConvite {
    return {
        conviteId: convite.getId(),
        projetoId: projeto.getId(),
        titulo: projeto.getTitulo(),
        produtor: projeto.getProdutor(),
        papel: convite.getPapel(),
        profissional: resumirProfissional(convite.getProfissional(), convite.getPapel())
    };
}
