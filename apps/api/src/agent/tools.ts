import { BadRequestException, NotFoundException } from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';
import type { PaymentMethod } from '../reservations/reservations.types.js';
import type { ReservationsService } from '../reservations/reservations.service.js';
import { maskCpf } from '../reservations/reservations.service.js';
import {
  availabilitySurface,
  bookingFormSurface,
  cancelledSurface,
  confirmationSurface,
  formatDateBR,
  hourLabel,
  rangeLabel,
  reservationsSurface,
  type BookingFormValues,
  type Surface,
} from './a2ui.js';

/** Shared booking draft, mirrored to the frontend through AG-UI STATE_SNAPSHOT. */
export interface BookingState {
  draft: {
    courtId?: number;
    date?: string;
    startHour?: number;
    durationHours?: number;
  };
  lastReservationId?: string;
}

export interface ToolContext {
  emitSurface(surface: Surface): void;
  state: BookingState;
  emitState(): void;
}

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'show_availability',
    description:
      'Mostra ao usuário a grade de disponibilidade das 3 quadras para uma data (UI interativa). Use sempre que o usuário quiser alugar/reservar ou ver horários.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Data no formato AAAA-MM-DD' } },
      required: ['date'],
      additionalProperties: false,
    },
  },
  {
    name: 'show_booking_form',
    description:
      'Mostra o formulário de dados pessoais para um horário já escolhido. Use quando o usuário informar quadra, data e hora por texto.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        courtId: { type: 'integer', description: 'Número da quadra: 1, 2 ou 3' },
        date: { type: 'string', description: 'Data no formato AAAA-MM-DD' },
        startHour: { type: 'integer', description: 'Hora de início (8 a 21)' },
        durationHours: { type: 'integer', description: 'Duração em horas: 1, 2 ou 3' },
      },
      required: ['courtId', 'date', 'startHour', 'durationHours'],
      additionalProperties: false,
    },
  },
  {
    name: 'lookup_reservations',
    description:
      'Mostra as reservas de um cliente (acompanhamento de status) a partir do CPF informado pelo usuário.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { cpf: { type: 'string', description: 'CPF com ou sem pontuação' } },
      required: ['cpf'],
      additionalProperties: false,
    },
  },
  {
    name: 'cancel_reservation',
    description: 'Cancela uma reserva pelo código (ex.: AB-1001). Só use após o usuário pedir o cancelamento.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Código da reserva' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
];

const first = (v: unknown): string => {
  const x = Array.isArray(v) ? v[0] : v;
  return x == null ? '' : String(x).trim();
};

export class BookingTools {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly ctx: ToolContext,
  ) {}

  /** Executes a Claude tool call; returns the text sent back as tool_result. */
  execute(name: string, input: Record<string, unknown>): string {
    try {
      switch (name) {
        case 'show_availability':
          return this.showAvailability(String(input.date));
        case 'show_booking_form':
          return this.showForm(
            Number(input.courtId),
            String(input.date),
            Number(input.startHour),
            Number(input.durationHours) || 1,
          );
        case 'lookup_reservations':
          return this.lookup(String(input.cpf));
        case 'cancel_reservation':
          return this.cancel(String(input.id));
        default:
          return `Ferramenta desconhecida: ${name}`;
      }
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof NotFoundException) {
        return `Erro: ${e.message}`;
      }
      throw e;
    }
  }

  /** Deterministic handling of A2UI button actions (no LLM). Returns assistant text. */
  handleAction(name: string, context: Record<string, unknown>): string {
    switch (name) {
      case 'change_date':
        return this.showAvailability(String(context.date), true);
      case 'select_slot':
        return this.showForm(
          Number(context.courtId),
          String(context.date),
          Number(context.startHour),
          1,
          true,
        );
      case 'submit_booking':
        return this.submit(context);
      case 'cancel_reservation':
        return this.cancel(String(context.id), true);
      default:
        return 'Não reconheci essa ação.';
    }
  }

  private showAvailability(date: string, forUser = false): string {
    const availability = this.reservations.getAvailability(date);
    this.ctx.state.draft = { ...this.ctx.state.draft, date };
    this.ctx.emitSurface(availabilitySurface(date, availability));
    this.ctx.emitState();
    if (forUser) return `Aqui está a disponibilidade de ${formatDateBR(date)}. Escolha um horário livre.`;
    return availability
      .map((a) => {
        const free = a.slots.filter((s) => s.free).map((s) => hourLabel(s.hour));
        return `${a.court.name}: livres ${free.join(', ') || 'nenhum'}`;
      })
      .join('\n')
      .concat('\n(A grade interativa já foi exibida ao usuário.)');
  }

  private showForm(
    courtId: number,
    date: string,
    startHour: number,
    durationHours: number,
    forUser = false,
    values?: BookingFormValues,
    error?: string,
  ): string {
    const court = this.reservations.listCourts().find((c) => c.id === courtId);
    if (!court) throw new BadRequestException('Quadra inexistente. Escolha entre as quadras 1, 2 e 3.');
    const slots = this.reservations.getAvailability(date).find((a) => a.court.id === courtId)?.slots ?? [];
    if (!slots.find((s) => s.hour === startHour)?.free) {
      throw new BadRequestException(`${court.name} não está livre às ${hourLabel(startHour)} em ${formatDateBR(date)}.`);
    }
    this.ctx.state.draft = { courtId, date, startHour, durationHours };
    this.ctx.emitSurface(
      bookingFormSurface({
        courtId,
        courtName: court.name,
        sports: court.sport,
        date,
        startHour,
        maxDuration: this.maxDuration(slots, startHour),
        values: values ?? { durationHours: String(durationHours) },
        error,
      }),
    );
    this.ctx.emitState();
    if (forUser) {
      return `Ótimo! ${court.name}, ${formatDateBR(date)} às ${hourLabel(startHour)}. Preencha os dados abaixo (1 a 3 horas) para concluir.`;
    }
    return `Formulário exibido para ${court.name}, ${formatDateBR(date)} às ${hourLabel(startHour)}. Aguarde o usuário preenchê-lo.`;
  }

  /** Consecutive free hours from startHour, capped at 3. */
  private maxDuration(slots: { hour: number; free: boolean }[], startHour: number): number {
    let n = 0;
    while (n < 3 && slots.find((s) => s.hour === startHour + n)?.free) n++;
    return Math.max(1, n);
  }

  private submit(c: Record<string, unknown>): string {
    const courtId = Number(c.courtId);
    const date = String(c.date);
    const startHour = Number(c.startHour);
    const values: BookingFormValues = {
      name: first(c.name),
      cpf: first(c.cpf),
      phone: first(c.phone),
      sport: first(c.sport),
      people: first(c.people),
      durationHours: first(c.durationHours) || '1',
      payment: first(c.payment),
    };
    try {
      const r = this.reservations.create({
        courtId,
        date,
        startHour,
        durationHours: Number(values.durationHours),
        name: values.name!,
        cpf: values.cpf!,
        phone: values.phone!,
        sport: values.sport!,
        people: Number(values.people),
        paymentMethod: values.payment as PaymentMethod,
      });
      this.ctx.state.lastReservationId = r.id;
      this.ctx.state.draft = {};
      this.ctx.emitSurface(confirmationSurface(r));
      this.ctx.emitState();
      return `Reserva ${r.id} registrada: ${r.courtName}, ${formatDateBR(r.date)}, ${rangeLabel(r.startHour, r.durationHours)}. Status: ${r.status}.`;
    } catch (e) {
      if (!(e instanceof BadRequestException)) throw e;
      const court = this.reservations.listCourts().find((x) => x.id === courtId);
      if (!court) return e.message;
      const slots = this.reservations.getAvailability(date).find((a) => a.court.id === courtId)?.slots ?? [];
      this.ctx.emitSurface(
        bookingFormSurface({
          courtId,
          courtName: court.name,
          sports: court.sport,
          date,
          startHour,
          maxDuration: this.maxDuration(slots, startHour),
          values,
          error: e.message,
        }),
      );
      return `Não consegui concluir a reserva: ${e.message}`;
    }
  }

  private lookup(cpf: string): string {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) throw new BadRequestException('CPF inválido: informe 11 dígitos.');
    const list = this.reservations.list({ cpf: digits });
    this.ctx.emitSurface(reservationsSurface(`Reservas do CPF ${maskCpf(digits)}`, list));
    if (!list.length) return 'Nenhuma reserva encontrada para esse CPF.';
    return (
      list
        .map((r) => `${r.id}: ${r.courtName}, ${formatDateBR(r.date)}, ${rangeLabel(r.startHour, r.durationHours)}, ${r.status}`)
        .join('\n') + '\n(A lista já foi exibida ao usuário.)'
    );
  }

  private cancel(id: string, forUser = false): string {
    const r = this.reservations.cancel(id);
    this.ctx.emitSurface(cancelledSurface(r));
    return forUser
      ? `A reserva ${r.id} foi cancelada.`
      : `Reserva ${r.id} cancelada com sucesso.`;
  }
}
