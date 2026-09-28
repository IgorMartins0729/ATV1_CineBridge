import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import {
    ConflitoError,
    ErroDominio,
    NaoEncontradoError,
    RestricaoInvalidaError,
    ValidacaoError
} from '../../domain/erros.js';

function statusDoErro(erro: ErroDominio): number {
    if (erro instanceof NaoEncontradoError) return 404;
    if (erro instanceof ConflitoError) return 409;
    if (erro instanceof RestricaoInvalidaError) return 422;
    if (erro instanceof ValidacaoError) return 400;
    return 400;
}

/** Converte erros de domínio e de validação em respostas HTTP padronizadas. */
export function tratarErro(erro: FastifyError | Error, requisicao: FastifyRequest, resposta: FastifyReply): void {
    if (erro instanceof ErroDominio) {
        void resposta.status(statusDoErro(erro)).send({
            erro: erro.codigo,
            mensagem: erro.message,
            ...(erro instanceof RestricaoInvalidaError ? { problemas: erro.getProblemas() } : {})
        });
        return;
    }

    const erroFastify = erro as FastifyError;
    if (erroFastify.validation) {
        void resposta.status(400).send({ erro: 'VALIDACAO', mensagem: erroFastify.message });
        return;
    }
    if (erroFastify.statusCode && erroFastify.statusCode < 500) {
        void resposta.status(erroFastify.statusCode).send({ erro: erroFastify.code ?? 'REQUISICAO_INVALIDA', mensagem: erro.message });
        return;
    }

    requisicao.log.error({ err: erro }, 'Erro inesperado');
    void resposta.status(500).send({ erro: 'ERRO_INTERNO', mensagem: 'Erro inesperado no servidor' });
}
