import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { EventType, type BaseEvent, type RunAgentInput } from '@ag-ui/core';
import { ReservationsService, SPACE_NAME } from '../reservations/reservations.service.js';
import type { Surface } from './a2ui.js';
import { BookingTools, TOOL_DEFINITIONS, type BookingState } from './tools.js';

export type Emit = (event: BaseEvent) => void;

const MAX_TOOL_ROUNDS = 6;

const systemPrompt = (today: string) => `Você é o assistente de reservas do ${SPACE_NAME}, um espaço de esportes de praia.
O espaço tem 3 quadras (1 e 2 de areia, 3 society), funciona das 08h às 22h e aceita reservas de 1 a 3 horas. Hoje é ${today}.

Como trabalhar:
- Responda sempre em português do Brasil, de forma curta e simpática.
- Para alugar uma quadra, chame show_availability com a data desejada (use ${today} se o usuário não disser). Nunca liste horários em texto nem invente disponibilidade: a grade interativa mostra tudo e o usuário escolhe nela.
- Se o usuário já disser quadra, data e hora, chame show_booking_form. Os dados pessoais (nome, CPF, telefone, esporte, pessoas, pagamento) são preenchidos no formulário exibido, não por texto.
- Para acompanhar reservas, peça o CPF e chame lookup_reservations. Para cancelar, use cancel_reservation somente após pedido claro e com o código da reserva.
- Depois de chamar uma ferramenta que exibe uma tela, escreva apenas uma frase convidando o usuário a usá-la.
- Se algo estiver fora do escopo de reservas, diga isso gentilmente.`;

@Injectable()
export class AgentService {
  private readonly log = new Logger(AgentService.name);
  private client?: Anthropic;

  constructor(private readonly reservations: ReservationsService) {}

  get mockMode(): boolean {
    return process.env.AGENT_MODE === 'mock' || !process.env.ANTHROPIC_API_KEY;
  }

  async run(input: RunAgentInput, emit: Emit, signal: AbortSignal): Promise<void> {
    const threadId = input.threadId ?? randomUUID();
    const runId = input.runId ?? randomUUID();
    emit({ type: EventType.RUN_STARTED, threadId, runId } as BaseEvent);

    const state: BookingState = this.readState(input.state);
    let stateDirty = false;
    const ctx = {
      state,
      emitState: () => {
        stateDirty = true;
        emit({ type: EventType.STATE_SNAPSHOT, snapshot: state } as BaseEvent);
      },
      emitSurface: (surface: Surface) => this.emitSurface(emit, surface),
    };
    const tools = new BookingTools(this.reservations, ctx);

    try {
      const action = this.readAction(input.forwardedProps);
      if (action) {
        let text: string;
        try {
          text = tools.handleAction(action.name, action.context);
        } catch (e) {
          if (e instanceof BadRequestException || e instanceof NotFoundException) text = e.message;
          else throw e;
        }
        this.say(emit, text);
      } else if (this.mockMode) {
        this.mockReply(input, tools, emit);
      } else {
        await this.claudeLoop(input, tools, emit, signal);
      }
      if (!stateDirty) emit({ type: EventType.STATE_SNAPSHOT, snapshot: state } as BaseEvent);
      emit({ type: EventType.RUN_FINISHED, threadId, runId } as BaseEvent);
    } catch (e) {
      if (signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      this.log.error(`run failed: ${message}`);
      emit({ type: EventType.RUN_ERROR, message, code: 'AGENT_ERROR' } as BaseEvent);
    }
  }

  // ------------------------------------------------------------------ helpers

  private readState(raw: unknown): BookingState {
    const s = (raw ?? {}) as Partial<BookingState>;
    return { draft: { ...(s.draft ?? {}) }, lastReservationId: s.lastReservationId };
  }

  private readAction(props: unknown): { name: string; context: Record<string, unknown> } | null {
    const ua = (props as { a2uiAction?: { userAction?: Record<string, unknown> } } | undefined)
      ?.a2uiAction?.userAction;
    if (!ua || typeof ua.name !== 'string') return null;
    return { name: ua.name, context: (ua.context as Record<string, unknown>) ?? {} };
  }

  private say(emit: Emit, text: string): void {
    const messageId = randomUUID();
    emit({ type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' } as BaseEvent);
    emit({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: text } as BaseEvent);
    emit({ type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent);
  }

  private emitSurface(emit: Emit, surface: Surface): void {
    emit({
      type: EventType.ACTIVITY_SNAPSHOT,
      messageId: `a2ui-surface-${surface.surfaceId}`,
      activityType: 'a2ui-surface',
      replace: true,
      content: { a2ui_operations: surface.operations },
    } as BaseEvent);
  }

  // --------------------------------------------------------------- mock mode

  private mockReply(input: RunAgentInput, tools: BookingTools, emit: Emit): void {
    const last = [...(input.messages ?? [])].reverse().find((m) => m.role === 'user');
    const text = last ? this.textOf(last.content) : '';
    const today = this.reservations.today();
    const run = (name: string, args: Record<string, unknown>) => {
      const result = tools.execute(name, args);
      return result.startsWith('Erro:') ? result.slice(6) : null;
    };

    const digits = text.replace(/\D/g, '');
    const code = text.match(/AB-\d+/i)?.[0].toUpperCase();
    if (code && /cancel/i.test(text)) {
      this.say(emit, run('cancel_reservation', { id: code }) ?? `Pronto, a reserva ${code} foi cancelada.`);
    } else if (digits.length === 11) {
      this.say(emit, run('lookup_reservations', { cpf: digits }) ?? 'Estas são as suas reservas:');
    } else if (/minha|status|acompanh|consultar/i.test(text)) {
      this.say(emit, 'Claro! Me informe o seu CPF (11 dígitos) para eu buscar suas reservas.');
    } else if (/reserv|alug|quadra|dispon|hor[aá]rio|jogar/i.test(text)) {
      const date = /amanh/i.test(text) ? this.addDay(today) : today;
      this.say(
        emit,
        run('show_availability', { date }) ?? 'Aqui estão os horários das nossas 3 quadras. Escolha um horário livre!',
      );
    } else {
      this.say(
        emit,
        `Olá! Sou o assistente do ${SPACE_NAME}. Posso ajudar você a reservar uma quadra (1 a 3 horas) ou acompanhar uma reserva. O que prefere?`,
      );
    }
  }

  private addDay(date: string): string {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  // -------------------------------------------------------------- Claude loop

  private textOf(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((p) => (p && typeof p === 'object' && (p as { type?: string }).type === 'text' ? (p as { text: string }).text : ''))
        .join('');
    }
    return '';
  }

  /** AG-UI messages -> Anthropic messages; drops tool calls that lack a result. */
  private toAnthropicMessages(input: RunAgentInput): Anthropic.MessageParam[] {
    const results = new Map<string, string>();
    for (const m of input.messages ?? []) {
      if (m.role === 'tool') results.set(m.toolCallId, this.textOf(m.content));
    }
    const out: Anthropic.MessageParam[] = [];
    for (const m of input.messages ?? []) {
      if (m.role === 'user') {
        const text = this.textOf(m.content).trim();
        if (text) out.push({ role: 'user', content: text });
      } else if (m.role === 'assistant') {
        const blocks: Anthropic.ContentBlockParam[] = [];
        const text = this.textOf(m.content).trim();
        if (text) blocks.push({ type: 'text', text });
        const resultBlocks: Anthropic.ToolResultBlockParam[] = [];
        for (const call of m.toolCalls ?? []) {
          // synthetic call appended by the CopilotKit A2UI middleware on action runs
          if (call.function.name === 'log_a2ui_event') continue;
          const content = results.get(call.id);
          if (content === undefined) continue;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || '{}');
          } catch {
            /* keep empty args */
          }
          blocks.push({ type: 'tool_use', id: call.id, name: call.function.name, input: args });
          resultBlocks.push({ type: 'tool_result', tool_use_id: call.id, content });
        }
        if (!blocks.length) continue;
        out.push({ role: 'assistant', content: blocks });
        if (resultBlocks.length) out.push({ role: 'user', content: resultBlocks });
      }
    }
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }

  private getClient(): Anthropic {
    return (this.client ??= new Anthropic());
  }

  private async claudeLoop(
    input: RunAgentInput,
    tools: BookingTools,
    emit: Emit,
    signal: AbortSignal,
  ): Promise<void> {
    const messages = this.toAnthropicMessages(input);
    if (!messages.length) {
      this.say(emit, `Olá! Sou o assistente do ${SPACE_NAME}. Quer reservar uma quadra ou acompanhar uma reserva?`);
      return;
    }
    const system = systemPrompt(this.reservations.today());

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const stream = this.getClient().messages.stream(
        {
          model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5',
          max_tokens: 16000,
          system,
          tools: TOOL_DEFINITIONS,
          messages,
          output_config: { effort: 'low' },
        },
        { signal },
      );

      const open = new Map<number, { type: 'text' | 'tool_use'; id: string }>();
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          const block = event.content_block;
          if (block.type === 'text') {
            const id = randomUUID();
            open.set(event.index, { type: 'text', id });
            emit({ type: EventType.TEXT_MESSAGE_START, messageId: id, role: 'assistant' } as BaseEvent);
          } else if (block.type === 'tool_use') {
            open.set(event.index, { type: 'tool_use', id: block.id });
            emit({ type: EventType.TOOL_CALL_START, toolCallId: block.id, toolCallName: block.name } as BaseEvent);
          }
        } else if (event.type === 'content_block_delta') {
          const b = open.get(event.index);
          if (!b) continue;
          if (event.delta.type === 'text_delta' && event.delta.text) {
            emit({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: b.id, delta: event.delta.text } as BaseEvent);
          } else if (event.delta.type === 'input_json_delta' && event.delta.partial_json) {
            emit({ type: EventType.TOOL_CALL_ARGS, toolCallId: b.id, delta: event.delta.partial_json } as BaseEvent);
          }
        } else if (event.type === 'content_block_stop') {
          const b = open.get(event.index);
          if (!b) continue;
          open.delete(event.index);
          emit(
            (b.type === 'text'
              ? { type: EventType.TEXT_MESSAGE_END, messageId: b.id }
              : { type: EventType.TOOL_CALL_END, toolCallId: b.id }) as BaseEvent,
          );
        }
      }
      const final = await stream.finalMessage();

      if (final.stop_reason === 'refusal') {
        this.say(emit, 'Não posso ajudar com esse pedido, mas posso cuidar das suas reservas de quadra.');
        return;
      }
      if (final.stop_reason !== 'tool_use') return;

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of final.content) {
        if (block.type !== 'tool_use') continue;
        const content = tools.execute(block.name, (block.input ?? {}) as Record<string, unknown>);
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content,
          is_error: content.startsWith('Erro:') || undefined,
        });
        emit({
          type: EventType.TOOL_CALL_RESULT,
          messageId: randomUUID(),
          toolCallId: block.id,
          content,
          role: 'tool',
        } as BaseEvent);
      }
      messages.push({ role: 'assistant', content: final.content }, { role: 'user', content: results });
    }
  }
}
