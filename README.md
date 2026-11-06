# Astral Beach Sports — Agentic UI

Assistente de reservas de quadras esportivas com **UI generativa**: o usuário conversa com um agente (Claude) e, em vez de respostas só em texto, recebe telas interativas (grade de horários, formulário de reserva, cartões de confirmação) renderizadas dentro do chat.

O projeto demonstra a integração de:

- **[AG-UI](https://docs.ag-ui.com)** — protocolo de eventos (SSE) entre agente e frontend.
- **A2UI** — superfícies de UI declarativas emitidas pelo agente, renderizadas com um catálogo custom de componentes **shadcn/ui**.
- **[CopilotKit](https://copilotkit.ai)** — runtime e componentes de chat no frontend.
- **Claude** (via `@anthropic-ai/sdk`) — LLM com tool use para orquestrar o fluxo de reserva.

## Cenário

O _Astral Beach Sports_ é um espaço de esportes de praia fictício:

| Quadra | Tipo | Esportes |
|---|---|---|
| Quadra 1 | Areia | Beach Tennis, Vôlei de Praia |
| Quadra 2 | Areia | Futevôlei, Vôlei de Praia |
| Quadra 3 | Society | Futebol, Futsal |

- Funcionamento das **08h às 22h**; reservas de **1 a 3 horas**.
- Pagamento: crédito, débito, PIX ou dinheiro (dinheiro fica `pendente`; demais ficam `confirmada`).
- Status possíveis: `pendente`, `confirmada`, `concluida`, `cancelada`.

## Estrutura

```
.
├── apps/
│   ├── api/      # Backend NestJS: agente AG-UI + API REST de reservas
│   └── web/      # Frontend Next.js: chat CopilotKit + catálogo A2UI (shadcn)
├── docs/
│   └── a2ui-shadcn-contract.md   # Contrato entre backend e frontend (componentes/ações A2UI)
└── package.json  # Workspaces npm
```

### `apps/api` — NestJS

- `src/agent/` — endpoint AG-UI e lógica do agente
  - `agent.controller.ts` — `POST /agui`, recebe `RunAgentInput` e transmite eventos AG-UI via SSE.
  - `agent.service.ts` — loop de tool use com Claude (streaming), modo mock e tratamento determinístico de ações de UI.
  - `tools.ts` — ferramentas do agente (`show_availability`, `show_booking_form`, `lookup_reservations`, `cancel_reservation`) e handlers das ações A2UI.
  - `a2ui.ts` — montagem das superfícies A2UI (`availability`, `booking-form`, `confirmation`, `reservations`).
- `src/reservations/` — domínio de reservas (armazenamento **em memória**, com dados de exemplo) e API REST.

### `apps/web` — Next.js

- `app/reservar` — chat com o assistente (CopilotKit + A2UI).
- `app/reservas` — consulta e cancelamento de reservas por CPF (via API REST).
- `app/api/copilotkit/[[...slug]]/route.ts` — CopilotKit Runtime, que repassa as requisições ao agente AG-UI do backend.
- `components/a2ui/` — componentes do catálogo custom: `SlotGrid`, `BookingForm`, `ReservationCard`, `ReservationList`.
- `lib/a2ui/` — definição do catálogo e schemas.
- `components/ui/` — componentes shadcn/ui.

## Como funciona

```
Navegador ──► Next.js /api/copilotkit (CopilotKit Runtime)
                  │  HttpAgent (AG-UI)
                  ▼
           NestJS POST /agui ──► Claude (tool use)
                  │                  │
                  │◄── ferramentas ──┘
                  ▼
     Eventos SSE: texto, tool calls, STATE_SNAPSHOT,
     ACTIVITY_SNAPSHOT (a2ui-surface) ──► chat renderiza componentes shadcn
```

1. O usuário escreve no chat; o agente chama ferramentas que emitem **superfícies A2UI** (ex.: a grade de disponibilidade).
2. Cliques nos componentes (escolher horário, enviar formulário, cancelar) geram **ações A2UI** (`select_slot`, `change_date`, `submit_booking`, `cancel_reservation`), tratadas no backend de forma **determinística, sem chamar o LLM**.
3. O rascunho da reserva é sincronizado com o frontend via `STATE_SNAPSHOT`.

Detalhes de props e ações de cada componente estão em [`docs/a2ui-shadcn-contract.md`](docs/a2ui-shadcn-contract.md).

## Pré-requisitos

- Node.js 20.12+ (o backend usa `process.loadEnvFile()` e ESM; os tipos do projeto miram o Node 24)
- npm
- Uma chave da API da Anthropic (opcional — sem ela o agente roda em modo mock)

## Configuração

Instale as dependências na raiz (workspaces):

```bash
npm install
```

Crie `apps/api/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-5-5   # opcional; padrão claude-opus-5-5
PORT=3001                         # opcional; padrão 3001
# AGENT_MODE=mock                 # força o modo mock (sem LLM)
# DEMO_TODAY=2026-10-27           # data "de hoje" usada pela demo
```

Variáveis opcionais do frontend (`apps/web/.env.local`):

```env
AGENT_URL=http://localhost:3001/agui          # endpoint AG-UI usado pelo CopilotKit Runtime
NEXT_PUBLIC_API_URL=http://localhost:3001     # API REST usada pela página /reservas
```

## Executando

Em dois terminais, a partir da raiz:

```bash
npm run dev:api   # NestJS em http://localhost:3001
npm run dev:web   # Next.js em http://localhost:3000
```

Acesse <http://localhost:3000> (redireciona para `/reservar`).

Build de produção de ambos os apps:

```bash
npm run build
```

### Modo mock

Se `ANTHROPIC_API_KEY` não estiver definida (ou `AGENT_MODE=mock`), o agente responde com regras simples por palavras-chave — útil para desenvolver a UI sem custo de API. Exemplos: "quero alugar uma quadra amanhã", "minhas reservas", um CPF com 11 dígitos, "cancelar AB-1003".

## API REST

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/courts` | Lista as quadras |
| `GET` | `/availability?date=AAAA-MM-DD` | Disponibilidade por quadra/hora |
| `GET` | `/reservations?cpf=...` | Lista reservas (filtro opcional por CPF) |
| `GET` | `/reservations/:id` | Detalhe de uma reserva |
| `POST` | `/reservations` | Cria uma reserva |
| `PATCH` | `/reservations/:id/cancel` | Cancela uma reserva pendente/confirmada |
| `POST` | `/agui` | Endpoint do agente (AG-UI, SSE) |

CPFs são retornados mascarados (`***.***.***-25`).

## Dados de demonstração

Os dados ficam em memória e são recriados a cada reinício do backend. A data "de hoje" da demo é fixa em **2026-10-27** (ajustável com `DEMO_TODAY`). CPFs de exemplo com reservas:

- `529.982.247-25`
- `111.444.777-35`
- `390.533.447-05`

## Testes

```bash
cd apps/api
npm test          # testes unitários (Vitest)
npm run test:e2e  # testes e2e
npm run lint      # oxlint
```

## Stack

- **Backend:** NestJS 12, TypeScript, `@anthropic-ai/sdk`, `@ag-ui/core`, `@ag-ui/encoder`, Vitest
- **Frontend:** Next.js 16, React 19, CopilotKit (`react-core`, `runtime`, `a2ui-renderer`), Tailwind CSS 4, shadcn/ui
