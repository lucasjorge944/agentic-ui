"use client";

import { useState } from "react";
import { CalendarDays, Clock, Users, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ReservationDTO } from "@/lib/a2ui/schemas";
import { fire, range, type Dispatch } from "./format";

const statusVariant: Record<ReservationDTO["status"], "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "secondary",
  confirmada: "default",
  concluida: "outline",
  cancelada: "destructive",
};

export function CancelButton({ id, dispatch }: { id: string; dispatch?: Dispatch }) {
  const [sent, setSent] = useState(false);
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" disabled={sent} />}>
        {sent ? "Cancelando…" : "Cancelar reserva"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar esta reserva?</AlertDialogTitle>
          <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Manter reserva</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              setSent(true);
              fire(dispatch, "cancel_reservation", { id });
            }}
          >
            Sim, cancelar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ReservationCard({
  props,
  dispatch,
}: {
  props: { title?: string; reservation: ReservationDTO; note?: string; canCancel: boolean };
  dispatch?: Dispatch;
}) {
  const { title, reservation: r, note, canCancel } = props;
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title ?? r.courtName}</CardTitle>
        <CardDescription>
          {title ? r.courtName : r.sport} · Reserva #{r.id}
        </CardDescription>
        <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
          <Badge variant={statusVariant[r.status]}>{r.statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <span className="flex items-center gap-2"><CalendarDays className="size-4 text-muted-foreground" />{r.dateLabel}</span>
        <span className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" />{range(r.startHour, r.durationHours)} ({r.durationHours} h)</span>
        <span className="flex items-center gap-2"><Users className="size-4 text-muted-foreground" />{r.customerName} · {r.people} {r.people === 1 ? "pessoa" : "pessoas"}</span>
        <span className="flex items-center gap-2"><CreditCard className="size-4 text-muted-foreground" />{r.paymentLabel}</span>
        <span className="text-muted-foreground sm:col-span-2">{r.sport} · CPF {r.cpfMasked}</span>
        {note && <p className="sm:col-span-2">{note}</p>}
      </CardContent>
      {canCancel && (
        <CardFooter>
          <CancelButton id={r.id} dispatch={dispatch} />
        </CardFooter>
      )}
    </Card>
  );
}
