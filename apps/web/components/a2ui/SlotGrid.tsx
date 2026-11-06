"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fire, pad, type Dispatch } from "./format";

type Court = { id: number; name: string; sports: string[]; slots: { hour: number; free: boolean }[] };
type Props = { date: string; dateLabel: string; prevDate?: string; nextDate?: string; courts: Court[] };

export function SlotGrid({ props, dispatch }: { props: Props; dispatch?: Dispatch }) {
  const { date, dateLabel, prevDate, nextDate, courts } = props;
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" disabled={!prevDate} onClick={() => prevDate && fire(dispatch, "change_date", { date: prevDate })}>
          <ChevronLeft /> Dia anterior
        </Button>
        <span className="text-sm font-medium">{dateLabel}</span>
        <Button variant="outline" size="sm" disabled={!nextDate} onClick={() => nextDate && fire(dispatch, "change_date", { date: nextDate })}>
          Próximo dia <ChevronRight />
        </Button>
      </div>
      {courts.map((court) => (
        <Card key={court.id} size="sm">
          <CardHeader>
            <CardTitle>{court.name}</CardTitle>
            <CardDescription>{court.sports.join(" · ")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-3" />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {court.slots.map((s) => (
                <Button
                  key={s.hour}
                  variant={s.free ? "outline" : "ghost"}
                  size="sm"
                  disabled={!s.free}
                  aria-label={`${pad(s.hour)} ${s.free ? "livre" : "ocupado"}`}
                  className={s.free ? "" : "line-through"}
                  onClick={() => fire(dispatch, "select_slot", { courtId: court.id, date, startHour: s.hour })}
                >
                  {pad(s.hour)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
