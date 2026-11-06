"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fire, range, type Dispatch } from "./format";

type Props = {
  courtId: number; courtName: string; sports: string[]; date: string; dateLabel: string;
  startHour: number; maxDuration: number; error?: string;
  defaults?: { name?: string; cpf?: string; phone?: string; sport?: string; people?: number | string; durationHours?: number | string; payment?: string };
};

const PAYMENTS = [
  { value: "credito", label: "Crédito" },
  { value: "debito", label: "Débito" },
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
];

const digits = (s: string) => s.replace(/\D/g, "");

export function BookingForm({ props, dispatch }: { props: Props; dispatch?: Dispatch }) {
  const { courtId, courtName, sports, date, dateLabel, startHour, maxDuration, error, defaults: d } = props;
  const [name, setName] = useState(d?.name ?? "");
  const [cpf, setCpf] = useState(d?.cpf ?? "");
  const [phone, setPhone] = useState(d?.phone ?? "");
  const [sport, setSport] = useState(d?.sport ?? sports[0] ?? "");
  const [people, setPeople] = useState(String(d?.people ?? 2));
  const [duration, setDuration] = useState(String(d?.durationHours ?? 1));
  const [payment, setPayment] = useState(d?.payment ?? "pix");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 3) errs.name = "Informe o nome completo.";
    if (digits(cpf).length !== 11) errs.cpf = "CPF deve ter 11 dígitos.";
    if (![10, 11].includes(digits(phone).length)) errs.phone = "Informe DDD + número.";
    if (!sport) errs.sport = "Escolha um esporte.";
    const n = Number(people);
    if (!Number.isInteger(n) || n < 1 || n > 22) errs.people = "Entre 1 e 22 pessoas.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSending(true);
    fire(dispatch, "submit_booking", {
      courtId, date, startHour, name: name.trim(), cpf: digits(cpf), phone: digits(phone),
      sport, people: n, durationHours: Number(duration), payment,
    });
  }

  const durations = Array.from({ length: Math.max(1, Math.min(3, maxDuration)) }, (_, i) => String(i + 1));
  const fieldErr = (k: string) => errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Reservar {courtName}</CardTitle>
        <CardDescription >
          {dateLabel} · a partir das {range(startHour, 1).split("–")[0]}
        </CardDescription>
      </CardHeader>
      <form onSubmit={submit} noValidate>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Não foi possível reservar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bf-name">Nome completo</Label>
            <Input id="bf-name" value={name} onChange={(e) => setName(e.target.value)} disabled={sending} aria-invalid={!!errors.name} />
            {fieldErr("name")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bf-cpf">CPF</Label>
              <Input id="bf-cpf" inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} disabled={sending} aria-invalid={!!errors.cpf} />
              {fieldErr("cpf")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bf-phone">Telefone (DDD)</Label>
              <Input id="bf-phone" inputMode="tel" placeholder="(11) 90000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sending} aria-invalid={!!errors.phone} />
              {fieldErr("phone")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Esporte</Label>
              <Select value={sport} onValueChange={(v) => setSport(v ?? "")} disabled={sending}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {sports.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {fieldErr("sport")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bf-people">Qtd. de pessoas</Label>
              <Input id="bf-people" type="number" min={1} max={22} value={people} onChange={(e) => setPeople(e.target.value)} disabled={sending} aria-invalid={!!errors.people} />
              {fieldErr("people")}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Duração</Label>
            <ToggleGroup variant="outline" value={[duration]} onValueChange={(v) => v[0] && setDuration(v[0])} disabled={sending}>
              {durations.map((h) => <ToggleGroupItem key={h} value={h}>{h} h</ToggleGroupItem>)}
            </ToggleGroup>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Pagamento</Label>
            <RadioGroup value={payment} onValueChange={(v) => setPayment(String(v))} disabled={sending} className="grid-cols-2 sm:grid-cols-4">
              {PAYMENTS.map((p) => (
                <Label key={p.value} className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value={p.value} /> {p.label}
                </Label>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
        <CardFooter className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={sending} onClick={() => fire(dispatch, "change_date", { date })}>
            Voltar à disponibilidade
          </Button>
          <Button type="submit" disabled={sending}>
            {sending && <Loader2 className="animate-spin" />} {sending ? "Enviando…" : "Confirmar reserva"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
