# CineBridge: microsserviço de recomendação e orquestração de equipes

Atividade prática ATV I. O serviço recebe um projeto audiovisual (gênero, duração, orçamento,
data de entrega, tipo de captação, localização e papéis obrigatórios com peso), consulta o cadastro de
profissionais, **ranqueia os candidatos por papel** respeitando orçamento e prazo e **monta uma ou mais
sugestões de equipe**. Depois acompanha os ajustes do produtor (aceitar, rejeitar, substituir, reavaliar),
os convites aos profissionais e, quando todos confirmam, **registra a equipe e dispara eventos** para os
microsserviços de gerenciamento de projetos e financeiro.

Stack: **Node.js 24 LTS · TypeScript (strict) · Fastify · Prisma · PostgreSQL · Vitest**.

---

## Como rodar

Pré-requisito: Node.js 24 ou superior (`node -v`). Funciona igual no Windows 10+ e no Ubuntu 24.04+.

```bash
cd backend
npm install          # também gera o Prisma Client
npm run dev          # http://localhost:3000 com 10.000 profissionais fictícios em memória
```

Não precisa de banco para rodar nem para testar: o padrão é o repositório **em memória**.

### Com PostgreSQL

1. Suba um PostgreSQL. Pode ser o Docker (`docker compose up -d`, dentro de `backend/`) ou uma instalação local.
2. Copie `backend/.env.example` para `backend/.env` e ajuste o `DATABASE_URL`. Em seguida, defina `REPOSITORIO=prisma`.
3. Crie as tabelas e popule com 10 mil profissionais:
   ```bash
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor em modo desenvolvimento (recarrega ao salvar) |
| `npm run build` / `npm start` | Compila para `dist/` e executa a versão compilada |
| `npm test` | Testes unitários e de integração |
| `npm run test:coverage` | Testes + relatório de cobertura (`coverage/index.html`) |
| `npm run demo` | Demonstração dos 4 padrões no terminal |
| `npm run carga` | Teste de carga (10 mil profissionais, 100 conexões simultâneas) |
| `npm run typecheck` | Verificação de tipos de todo o projeto |
| `npm run db:migrate` / `npm run db:seed` | Migrations e seed do PostgreSQL |

---

## Endpoints REST

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/projetos/recomendacoes` | **Principal:** recebe o projeto, aplica a estratégia e retorna a equipe recomendada |
| `GET` | `/projetos/:id` | Projeto e equipe atual |
| `POST` | `/projetos/:id/recomendacoes` | Nova recomendação completa (opcional: `{ "estrategia": "..." }`) |
| `POST` | `/projetos/:id/membros/:papel/aceitar` | Produtor aceita o sugerido e o convite é enviado |
| `POST` | `/projetos/:id/membros/:papel/rejeitar` | Rejeita e faz nova rodada **só para esse papel** |
| `POST` | `/projetos/:id/membros/:papel/substituir` | Substitui (opcional: `{ "profissionalId": "..." }`) |
| `PATCH` | `/projetos/:id/restricoes` | Altera orçamento/prazo; se a mudança for significativa, reavalia a equipe toda |
| `GET` | `/projetos/:id/convites` | Convites do projeto |
| `GET` | `/projetos/:id/relatorio` | Resultado dos 3 visitantes (consistência, compatibilidade e relatório) |
| `GET` / `POST` | `/convites/:id` e `/convites/:id/resposta` | Profissional aceita ou recusa: `{ "aceito": true }` |
| `GET` | `/estrategias`, `/health`, `/auditoria`, `/mensagens/:destinatarioId` | Consultas de apoio |

Exemplo:

```bash
curl -X POST http://localhost:3000/projetos/recomendacoes -H "Content-Type: application/json" -d '{
  "titulo": "Vozes do Sertão",
  "produtor": { "id": "prod-1", "nome": "Paula Lima", "email": "paula@produtora.com" },
  "genero": "drama", "duracao": 95, "orcamento": 180000, "prazo": "2027-06-30",
  "tipoCaptacao": "FICCAO", "localizacao": { "cidade": "Recife", "uf": "PE" },
  "papeisObrigatorios": [ { "papel": "DIRETOR", "peso": 3 }, { "papel": "EDITOR", "peso": 1 } ],
  "estrategia": "similaridade-cosseno"
}'
```

Erros: `400` (entrada inválida), `404` (não encontrado), `409` (conflito, ex.: equipe já formada),
`422` (projeto não atende às restrições, ex.: data de entrega no passado).

---

## Arquitetura

Camadas com **inversão de dependência**: `domain` e `application` só conhecem interfaces (`application/ports`).
As implementações concretas ficam em `infrastructure` e são ligadas em um único lugar,
`config/container.ts` (composition root, com **injeção de dependências explícita** pelo construtor).

```
backend/src
├── domain/            entidades, enums, value objects, erros, interface do Visitor
├── application/
│   ├── ports/         interfaces: repositórios, EventBus, logger, canais de notificação
│   ├── strategies/    Strategy
│   ├── orquestrador/  Template Method
│   ├── observers/     Observer (SistemaRecomendacao = sujeito)
│   ├── visitors/      Visitor
│   └── services/      casos de uso (projeto, equipe, convites) e tolerância a falhas
├── infrastructure/    Fastify, Prisma, memória, EventEmitter, pino, integrações
├── config/            container (DI) e parâmetros do algoritmo
└── server.ts
```

O diagrama refinado está em [`docs/diagrama-refinado.puml`](docs/diagrama-refinado.puml).

