"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  cancelReservation,
  listReservations,
  type Reservation,
  type ReservationStatus,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS: Record<ReservationStatus, { label: string; cls: string }> = {
  pendente: {
    label: "Pendente",
    cls: "bg-accent text-accent-foreground",
  },
  confirmada: {
    label: "Confirmada",
    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  },
  concluida: {
    label: "Concluída",
    cls: "bg-primary/15 text-primary",
  },
  cancelada: {
    label: "Cancelada",
    cls: "bg-destructive/15 text-destructive",
  },
};

const TABS = [
  { value: "todas", label: "Todas" },
  { value: "pendente", label: "Pendentes" },
  { value: "confirmada", label: "Confirmadas" },
  { value: "concluida", label: "Concluídas" },
  { value: "cancelada", label: "Canceladas" },
];

const brDate = (iso: string) => iso.split("-").reverse().join("/");
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const digits = (v: string) => v.replace(/\D/g, "");

export default function ReservasPage() {
  const [items, setItems] = useState<Reservation[]>([]);
  const [cpf, setCpf] = useState("");
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("todas");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toCancel, setToCancel] = useState<Reservation | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listReservations(filter || undefined));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar reservas");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch + polling
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function confirmCancel() {
    if (!toCancel) return;
    const target = toCancel;
    setToCancel(null);
    try {
      await cancelReservation(target.id);
      toast.success("Reserva cancelada com sucesso.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cancelar reserva");
    }
  }

  const visible =
    status === "todas" ? items : items.filter((r) => r.status === status);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Acompanhe suas reservas</h1>
          <p className="text-sm text-muted-foreground">
            Atualiza automaticamente a cada 5 segundos.
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter(digits(cpf));
          }}
        >
          <Input
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="Buscar por CPF"
            aria-label="Buscar por CPF"
            inputMode="numeric"
            className="h-8 w-full sm:w-48"
          />
          <Button type="submit">
            <SearchIcon data-icon="inline-start" />
            Buscar
          </Button>
          {filter && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCpf("");
                setFilter("");
              }}
            >
              <XIcon data-icon="inline-start" />
              Limpar
            </Button>
          )}
        </form>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(String(v))} className="mb-4">
        <div className="overflow-x-auto">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Nenhuma reserva encontrada.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {visible.map((r) => {
            const st = STATUS[r.status];
            const cancellable = r.status === "pendente" || r.status === "confirmada";
            return (
              <li key={r.id}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">{r.courtName}</CardTitle>
                    <CardDescription>
                      {brDate(r.date)} · {hh(r.startHour)}–{hh(r.startHour + r.durationHours)} ({r.durationHours}h)
                    </CardDescription>
                    <CardAction>
                      <Badge className={cn("border-0", st.cls)}>{st.label}</Badge>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">Cliente</dt>
                      <dd>{r.customer.name}</dd>
                      <dt className="text-muted-foreground">CPF</dt>
                      <dd>{r.customer.cpf}</dd>
                      <dt className="text-muted-foreground">Esporte</dt>
                      <dd>{r.sport}</dd>
                      <dt className="text-muted-foreground">Pessoas</dt>
                      <dd>{r.people}</dd>
                      <dt className="text-muted-foreground">Pagamento</dt>
                      <dd>{r.paymentMethod}</dd>
                    </dl>
                  </CardContent>
                  <CardFooter className="justify-between">
                    <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
                    {cancellable && (
                      <Button variant="destructive" size="sm" onClick={() => setToCancel(r)}>
                        Cancelar
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={toCancel !== null} onOpenChange={(o) => !o && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              {toCancel &&
                `${toCancel.courtName} em ${brDate(toCancel.date)}, ${hh(toCancel.startHour)}–${hh(toCancel.startHour + toCancel.durationHours)}. Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter reserva</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmCancel}>
              Cancelar reserva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
