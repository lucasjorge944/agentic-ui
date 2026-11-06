import { maskCpf } from '../reservations/reservations.service.js';
import type {
  CourtAvailability,
  PaymentMethod,
  Reservation,
} from '../reservations/reservations.types.js';

/** A2UI v0.9 surfaces with the custom shadcn catalog (docs/a2ui-shadcn-contract.md), built deterministically. */

export const CATALOG_ID = 'https://astralbeach.app/a2ui/catalog/v1';

export type A2uiOperation = Record<string, unknown> & { version: 'v0.9' };

export interface Surface {
  surfaceId: string;
  operations: A2uiOperation[];
}


export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  credito: 'Crédito',
  debito: 'Débito',
  pix: 'PIX',
  dinheiro: 'Dinheiro',
};

export const STATUS_LABELS: Record<Reservation['status'], string> = {
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const pad = (n: number) => String(n).padStart(2, '0');
export const hourLabel = (h: number) => `${pad(h)}h`;
export const rangeLabel = (start: number, dur: number) => `${pad(start)}h às ${pad(start + dur)}h`;

export function formatDateBR(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

export function addDays(date: string, days: number): string {
  const dt = new Date(`${date}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

const WEEKDAYS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
export function dateLabel(date: string): string {
  const wd = WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
  return `${wd}, ${formatDateBR(date)}`;
}

export interface ReservationDTO {
  id: string;
  courtName: string;
  date: string;
  dateLabel: string;
  startHour: number;
  durationHours: number;
  customerName: string;
  cpfMasked: string;
  sport: string;
  people: number;
  paymentMethod: PaymentMethod;
  paymentLabel: string;
  status: Reservation['status'];
  statusLabel: string;
}

export function toReservationDTO(r: Reservation): ReservationDTO {
  return {
    id: r.id,
    courtName: r.courtName,
    date: r.date,
    dateLabel: dateLabel(r.date),
    startHour: r.startHour,
    durationHours: r.durationHours,
    customerName: r.customer.name,
    cpfMasked: maskCpf(r.customer.cpf),
    sport: r.sport,
    people: r.people,
    paymentMethod: r.paymentMethod,
    paymentLabel: PAYMENT_LABELS[r.paymentMethod],
    status: r.status,
    statusLabel: STATUS_LABELS[r.status],
  };
}

function surface(surfaceId: string, component: string, props: Record<string, unknown>): Surface {
  return {
    surfaceId,
    operations: [
      {
        version: 'v0.9',
        createSurface: { surfaceId, catalogId: CATALOG_ID, sendDataModel: false },
      },
      {
        version: 'v0.9',
        updateComponents: { surfaceId, components: [{ id: 'root', component, ...props }] },
      },
    ],
  };
}

export function availabilitySurface(date: string, availability: CourtAvailability[]): Surface {
  return surface('availability', 'SlotGrid', {
    date,
    dateLabel: dateLabel(date),
    prevDate: addDays(date, -1),
    nextDate: addDays(date, 1),
    courts: availability.map(({ court, slots }) => ({
      id: court.id,
      name: court.name,
      sports: court.sport,
      slots: slots.map((s) => ({ hour: s.hour, free: s.free })),
    })),
  });
}

export interface BookingFormValues {
  name?: string;
  cpf?: string;
  phone?: string;
  sport?: string;
  people?: string;
  durationHours?: string;
  payment?: string;
}

export function bookingFormSurface(args: {
  courtId: number;
  courtName: string;
  sports: string[];
  date: string;
  startHour: number;
  maxDuration: number;
  values?: BookingFormValues;
  error?: string;
}): Surface {
  const v = args.values ?? {};
  const defaults: Record<string, unknown> = {};
  if (v.name) defaults.name = v.name;
  if (v.cpf) defaults.cpf = v.cpf;
  if (v.phone) defaults.phone = v.phone;
  if (v.sport) defaults.sport = v.sport;
  if (v.people) defaults.people = Number(v.people) || undefined;
  if (v.durationHours) defaults.durationHours = Number(v.durationHours) || undefined;
  if (v.payment) defaults.payment = v.payment;
  return surface('booking-form', 'BookingForm', {
    courtId: args.courtId,
    courtName: args.courtName,
    sports: args.sports,
    date: args.date,
    dateLabel: dateLabel(args.date),
    startHour: args.startHour,
    maxDuration: Math.min(3, Math.max(1, args.maxDuration)),
    ...(args.error ? { error: args.error } : {}),
    ...(Object.keys(defaults).length ? { defaults } : {}),
  });
}

export function confirmationSurface(r: Reservation): Surface {
  return surface('confirmation', 'ReservationCard', {
    title: 'Reserva registrada!',
    reservation: toReservationDTO(r),
    note:
      r.status === 'pendente'
        ? 'Pagamento em dinheiro: acerte no balcão antes do início. A reserva fica pendente até lá.'
        : 'Pagamento confirmado. Apresente seu nome na recepção.',
    canCancel: r.status === 'pendente' || r.status === 'confirmada',
  });
}

export function cancelledSurface(r: Reservation): Surface {
  return surface('reservations', 'ReservationCard', {
    title: 'Reserva cancelada',
    reservation: toReservationDTO(r),
    canCancel: false,
  });
}

export function reservationsSurface(title: string, list: Reservation[]): Surface {
  return surface('reservations', 'ReservationList', {
    title,
    reservations: list.map(toReservationDTO),
    emptyText: 'Nenhuma reserva encontrada.',
  });
}
