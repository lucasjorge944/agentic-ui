export type PaymentMethod = 'credito' | 'debito' | 'pix' | 'dinheiro';
export type ReservationStatus =
  | 'pendente'
  | 'confirmada'
  | 'concluida'
  | 'cancelada';

export interface Court {
  id: number;
  name: string;
  sport: string[];
}

export interface Reservation {
  id: string;
  courtId: number;
  courtName: string;
  date: string; // YYYY-MM-DD
  startHour: number;
  durationHours: 1 | 2 | 3;
  customer: { name: string; cpf: string; phone: string };
  sport: string;
  people: number;
  paymentMethod: PaymentMethod;
  status: ReservationStatus;
  createdAt: string;
}

export interface CreateReservationInput {
  courtId: number;
  date: string;
  startHour: number;
  durationHours: number;
  name: string;
  cpf: string;
  phone: string;
  sport: string;
  people: number;
  paymentMethod: PaymentMethod;
}

export interface Slot {
  hour: number;
  free: boolean;
}

export interface CourtAvailability {
  court: Court;
  slots: Slot[];
}
