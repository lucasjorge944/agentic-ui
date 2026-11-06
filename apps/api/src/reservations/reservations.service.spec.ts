import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { ReservationsService, maskCpf } from './reservations.service.js';
import type { CreateReservationInput } from './reservations.types.js';

const base: CreateReservationInput = {
  courtId: 2,
  date: '2026-11-02',
  startHour: 10,
  durationHours: 2,
  name: 'Fulano de Tal',
  cpf: '529.982.247-25',
  phone: '(11) 98765-4321',
  sport: 'Futevôlei',
  people: 4,
  paymentMethod: 'pix',
};

describe('ReservationsService', () => {
  let service: ReservationsService;
  beforeEach(() => {
    service = new ReservationsService();
  });

  it('shows seeded busy slots in availability', () => {
    const court1 = service.getAvailability('2026-10-27')[0];
    expect(court1.slots.find((s) => s.hour === 9)?.free).toBe(false);
    expect(court1.slots.find((s) => s.hour === 10)?.free).toBe(false);
    expect(court1.slots.find((s) => s.hour === 12)?.free).toBe(true);
    expect(court1.slots).toHaveLength(14);
  });

  it('creates a confirmed reservation and blocks the slots', () => {
    const r = service.create(base);
    expect(r.status).toBe('confirmada');
    const slots = service.getAvailability(base.date)[1].slots;
    expect(slots.filter((s) => !s.free).map((s) => s.hour)).toEqual([10, 11]);
  });

  it('cash reservations are pending', () => {
    expect(service.create({ ...base, paymentMethod: 'dinheiro' }).status).toBe('pendente');
  });

  it('rejects overlapping reservations', () => {
    service.create(base);
    expect(() => service.create({ ...base, startHour: 11, durationHours: 1 })).toThrow(/Conflito/);
  });

  it('allows the same hour on another court', () => {
    service.create(base);
    expect(() => service.create({ ...base, courtId: 1 })).not.toThrow();
  });

  it.each([
    ['duration 4', { durationHours: 4 }, /1 a 3 horas/],
    ['duration 0', { durationHours: 0 }, /1 a 3 horas/],
    ['too early', { startHour: 7 }, /fora do funcionamento/],
    ['ends after close', { startHour: 21, durationHours: 2 }, /fora do funcionamento/],
    ['past date', { date: '2026-10-20' }, /passada/],
    ['bad cpf', { cpf: '111.111.111-11' }, /CPF/],
    ['bad cpf digits', { cpf: '529.982.247-26' }, /CPF/],
    ['bad phone', { phone: '1234' }, /Telefone/],
    ['too few people', { people: 0 }, /pessoas/],
    ['too many people', { people: 23 }, /pessoas/],
    ['bad payment', { paymentMethod: 'cheque' as never }, /pagamento/],
    ['bad court', { courtId: 9 }, /Quadra/],
  ])('rejects %s', (_n, patch, msg) => {
    expect(() => service.create({ ...base, ...patch })).toThrow(BadRequestException);
    expect(() => service.create({ ...base, ...patch })).toThrow(msg);
  });

  it('lists by cpf, sorted, and cancels', () => {
    const mine = service.list({ cpf: '529.982.247-25' });
    expect(mine.length).toBeGreaterThan(1);
    const sorted = [...mine].sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour);
    expect(mine).toEqual(sorted);
    const r = service.create(base);
    expect(service.cancel(r.id).status).toBe('cancelada');
    expect(() => service.cancel(r.id)).toThrow(BadRequestException);
    expect(service.getAvailability(base.date)[1].slots.every((s) => s.free)).toBe(true);
  });

  it('masks cpf', () => {
    expect(maskCpf('52998224725')).toBe('***.***.***-25');
  });
});
