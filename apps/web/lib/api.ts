export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ReservationStatus =
  | "pendente"
  | "confirmada"
  | "concluida"
  | "cancelada";

export interface Reservation {
  id: string;
  courtId: number;
  courtName: string;
  date: string;
  startHour: number;
  durationHours: number;
  customer: { name: string; cpf: string; phone: string };
  sport: string;
  people: number;
  paymentMethod: string;
  status: ReservationStatus;
  createdAt: string;
}

export async function listReservations(cpf?: string): Promise<Reservation[]> {
  const qs = cpf ? `?cpf=${encodeURIComponent(cpf)}` : "";
  const res = await fetch(`${API_URL}/reservations${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Falha ao carregar reservas (${res.status})`);
  return res.json();
}

export async function cancelReservation(id: string): Promise<Reservation> {
  const res = await fetch(`${API_URL}/reservations/${id}/cancel`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error(`Falha ao cancelar reserva (${res.status})`);
  return res.json();
}
