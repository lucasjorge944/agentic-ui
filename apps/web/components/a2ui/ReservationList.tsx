"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { ReservationDTO } from "@/lib/a2ui/schemas";
import { CancelButton } from "./ReservationCard";
import { range, type Dispatch } from "./format";

export function ReservationList({
  props,
  dispatch,
}: {
  props: { title: string; reservations: ReservationDTO[]; emptyText?: string };
  dispatch?: Dispatch;
}) {
  const { title, reservations, emptyText } = props;
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {reservations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText ?? "Nenhuma reserva encontrada."}</p>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="flex flex-col">
              {reservations.map((r, i) => (
                <li key={r.id}>
                  {i > 0 && <Separator className="my-3" />}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{r.courtName} · #{r.id}</p>
                      <p className="text-muted-foreground">
                        {r.dateLabel} · {range(r.startHour, r.durationHours)} · {r.sport}
                      </p>
                      <p className="text-muted-foreground">{r.customerName} · {r.paymentLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.status === "cancelada" ? "destructive" : r.status === "confirmada" ? "default" : "secondary"}>
                        {r.statusLabel}
                      </Badge>
                      {(r.status === "pendente" || r.status === "confirmada") && <CancelButton id={r.id} dispatch={dispatch} />}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
