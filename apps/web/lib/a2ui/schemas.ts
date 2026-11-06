import { z } from "zod";
import type { CatalogDefinitions } from "@copilotkit/a2ui-renderer";

const reservation = z.object({
  id: z.string(),
  courtName: z.string(),
  date: z.string(),
  dateLabel: z.string(),
  startHour: z.number(),
  durationHours: z.number(),
  customerName: z.string(),
  cpfMasked: z.string(),
  sport: z.string(),
  people: z.number(),
  paymentMethod: z.enum(["credito", "debito", "pix", "dinheiro"]),
  paymentLabel: z.string(),
  status: z.enum(["pendente", "confirmada", "concluida", "cancelada"]),
  statusLabel: z.string(),
});

export type ReservationDTO = z.infer<typeof reservation>;

export const catalogDefinitions = {
  SlotGrid: {
    description: "Grade de horários por quadra para um dia. Slot livre dispara select_slot; dia anterior/próximo dispara change_date.",
    props: z.object({
      date: z.string(),
      dateLabel: z.string(),
      prevDate: z.string().optional(),
      nextDate: z.string().optional(),
      courts: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          sports: z.array(z.string()),
          slots: z.array(z.object({ hour: z.number(), free: z.boolean() })),
        }),
      ),
    }),
  },
  BookingForm: {
    description: "Formulário de reserva. Enviar dispara submit_booking; voltar dispara change_date.",
    props: z.object({
      courtId: z.number(),
      courtName: z.string(),
      sports: z.array(z.string()),
      date: z.string(),
      dateLabel: z.string(),
      startHour: z.number(),
      maxDuration: z.number(),
      error: z.string().optional(),
      defaults: z
        .object({
          name: z.string().optional(),
          cpf: z.string().optional(),
          phone: z.string().optional(),
          sport: z.string().optional(),
          people: z.union([z.number(), z.string()]).optional(),
          durationHours: z.union([z.number(), z.string()]).optional(),
          payment: z.string().optional(),
        })
        .optional(),
    }),
  },
  ReservationCard: {
    description: "Cartão de uma reserva; se canCancel, permite cancelar (cancel_reservation).",
    props: z.object({
      title: z.string().optional(),
      reservation,
      note: z.string().optional(),
      canCancel: z.boolean(),
    }),
  },
  ReservationList: {
    description: "Lista de reservas em formato compacto.",
    props: z.object({
      title: z.string(),
      reservations: z.array(reservation),
      emptyText: z.string().optional(),
    }),
  },
} satisfies CatalogDefinitions;
