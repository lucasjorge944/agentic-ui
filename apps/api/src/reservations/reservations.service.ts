import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Court,
  CourtAvailability,
  CreateReservationInput,
  PaymentMethod,
  Reservation,
} from './reservations.types.js';

export const SPACE_NAME = 'Astral Beach Sports';
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 22;
const PAYMENTS: PaymentMethod[] = ['credito', 'debito', 'pix', 'dinheiro'];
const TODAY = '2026-10-27';

const COURTS: Court[] = [
  { id: 1, name: 'Quadra 1 - Areia', sport: ['Beach Tennis', 'Vôlei de Praia'] },
  { id: 2, name: 'Quadra 2 - Areia', sport: ['Futevôlei', 'Vôlei de Praia'] },
  { id: 3, name: 'Quadra 3 - Society', sport: ['Futebol', 'Futsal'] },
];

export function maskCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  return `***.***.***-${d.slice(-2)}`;
}

function validCpf(raw: string): boolean {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(d[len])) return false;
  }
  return true;
}

@Injectable()
export class ReservationsService {
  private readonly reservations = new Map<string, Reservation>();
  private seq = 1000;

  constructor() {
    this.seed();
  }

  /** Current date (YYYY-MM-DD); fixed for the demo, overridable in tests. */
  today(): string {
    return process.env.DEMO_TODAY ?? TODAY;
  }

  listCourts(): Court[] {
    return COURTS;
  }

  getAvailability(date: string): CourtAvailability[] {
    this.assertDate(date);
    return COURTS.map((court) => {
      const busy = new Set<number>();
      for (const r of this.reservations.values()) {
        if (r.courtId !== court.id || r.date !== date || r.status === 'cancelada') continue;
        for (let h = r.startHour; h < r.startHour + r.durationHours; h++) busy.add(h);
      }
      const slots = [];
      for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
        slots.push({ hour, free: !busy.has(hour) });
      }
      return { court, slots };
    });
  }

  create(input: CreateReservationInput): Reservation {
    const court = COURTS.find((c) => c.id === Number(input.courtId));
    if (!court) throw new BadRequestException('Quadra inexistente. Escolha entre as quadras 1, 2 e 3.');
    this.assertDate(input.date);
    if (input.date < this.today()) {
      throw new BadRequestException('Não é possível reservar uma data passada.');
    }
    const duration = Number(input.durationHours);
    if (!Number.isInteger(duration) || duration < 1 || duration > 3) {
      throw new BadRequestException('A duração da reserva deve ser de 1 a 3 horas.');
    }
    const start = Number(input.startHour);
    if (!Number.isInteger(start) || start < OPEN_HOUR || start + duration > CLOSE_HOUR) {
      throw new BadRequestException(
        `Horário fora do funcionamento (${OPEN_HOUR}h às ${CLOSE_HOUR}h).`,
      );
    }
    if (!input.name?.trim()) throw new BadRequestException('Informe o nome completo.');
    if (!validCpf(String(input.cpf ?? ''))) throw new BadRequestException('CPF inválido.');
    const phone = String(input.phone ?? '').replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 11) {
      throw new BadRequestException('Telefone inválido. Informe DDD + número (10 ou 11 dígitos).');
    }
    const people = Number(input.people);
    if (!Number.isInteger(people) || people < 1 || people > 22) {
      throw new BadRequestException('A quantidade de pessoas deve ser de 1 a 22.');
    }
    if (!PAYMENTS.includes(input.paymentMethod)) {
      throw new BadRequestException('Método de pagamento inválido. Use crédito, débito, PIX ou dinheiro.');
    }
    if (!input.sport?.trim()) throw new BadRequestException('Informe o esporte.');

    const slots = this.getAvailability(input.date).find((a) => a.court.id === court.id)!.slots;
    for (let h = start; h < start + duration; h++) {
      if (!slots.find((s) => s.hour === h)?.free) {
        throw new BadRequestException(
          `Conflito de horário: ${court.name} já está reservada às ${h}h em ${input.date}.`,
        );
      }
    }

    const reservation: Reservation = {
      id: `AB-${++this.seq}`,
      courtId: court.id,
      courtName: court.name,
      date: input.date,
      startHour: start,
      durationHours: duration as 1 | 2 | 3,
      customer: { name: input.name.trim(), cpf: input.cpf.replace(/\D/g, ''), phone },
      sport: input.sport.trim(),
      people,
      paymentMethod: input.paymentMethod,
      status: input.paymentMethod === 'dinheiro' ? 'pendente' : 'confirmada',
      createdAt: new Date().toISOString(),
    };
    this.reservations.set(reservation.id, reservation);
    return reservation;
  }

  list(filter?: { cpf?: string }): Reservation[] {
    const cpf = filter?.cpf?.replace(/\D/g, '');
    return [...this.reservations.values()]
      .filter((r) => !cpf || r.customer.cpf === cpf)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour);
  }

  get(id: string): Reservation {
    const r = this.reservations.get(id);
    if (!r) throw new NotFoundException(`Reserva ${id} não encontrada.`);
    return r;
  }

  cancel(id: string): Reservation {
    const r = this.get(id);
    if (r.status !== 'pendente' && r.status !== 'confirmada') {
      throw new BadRequestException(`Reservas ${r.status}s não podem ser canceladas.`);
    }
    r.status = 'cancelada';
    return r;
  }

  private assertDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || Number.isNaN(Date.parse(date))) {
      throw new BadRequestException('Data inválida. Use o formato AAAA-MM-DD.');
    }
  }

  private seed() {
    const add = (
      courtId: number,
      date: string,
      startHour: number,
      durationHours: 1 | 2 | 3,
      name: string,
      cpf: string,
      sport: string,
      people: number,
      paymentMethod: PaymentMethod,
      status: Reservation['status'],
    ) => {
      const court = COURTS.find((c) => c.id === courtId)!;
      const id = `AB-${++this.seq}`;
      this.reservations.set(id, {
        id,
        courtId,
        courtName: court.name,
        date,
        startHour,
        durationHours,
        customer: { name, cpf, phone: '11987654321' },
        sport,
        people,
        paymentMethod,
        status,
        createdAt: '2026-10-20T12:00:00.000Z',
      });
    };
    // Valid sample CPFs (check digits verified)
    add(1, '2026-10-25', 18, 2, 'Marina Costa', '52998224725', 'Beach Tennis', 4, 'pix', 'concluida');
    add(3, '2026-10-26', 20, 1, 'Rafael Lima', '11144477735', 'Futebol', 12, 'credito', 'concluida');
    add(1, '2026-10-27', 9, 2, 'Carlos Souza', '39053344705', 'Beach Tennis', 4, 'pix', 'confirmada');
    add(1, '2026-10-27', 18, 3, 'Ana Ribeiro', '52998224725', 'Vôlei de Praia', 10, 'credito', 'confirmada');
    add(2, '2026-10-27', 10, 1, 'Bruno Alves', '11144477735', 'Futevôlei', 4, 'debito', 'confirmada');
    add(2, '2026-10-27', 19, 2, 'Julia Mendes', '39053344705', 'Futevôlei', 6, 'dinheiro', 'pendente');
    add(3, '2026-10-27', 20, 2, 'Time do Pedro', '52998224725', 'Futebol', 14, 'pix', 'confirmada');
    add(1, '2026-10-28', 19, 2, 'Marina Costa', '52998224725', 'Beach Tennis', 4, 'pix', 'confirmada');
    add(3, '2026-10-28', 21, 1, 'Rafael Lima', '11144477735', 'Futsal', 10, 'dinheiro', 'pendente');
    add(2, '2026-10-29', 8, 3, 'Escolinha Sol', '39053344705', 'Futevôlei', 12, 'credito', 'confirmada');
  }
}
