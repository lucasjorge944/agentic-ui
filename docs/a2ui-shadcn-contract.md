# Contrato A2UI custom (shadcn) — fonte única da verdade

Catálogo custom que SUBSTITUI o basic catalog nas telas do chat. Backend (apps/api/src/agent) emite; frontend (apps/web/components/a2ui) renderiza com shadcn.

## Catálogo
- `CATALOG_ID = "https://astralbeach.app/a2ui/catalog/v1"` (frontend exporta de `apps/web/lib/a2ui/catalog-id.ts`; backend repete a mesma string em `a2ui.ts`).
- Se o `createCatalog` do `@copilotkit/a2ui-renderer` exigir/gerar outro id, o worker do frontend DEVE: (a) tentar passar este id; (b) se impossível, usar o id que o renderer aceita e atualizar ESTE arquivo (seção Catálogo) + avisar o coordenador no `worker_done`. Manter `includeBasicCatalog: true` como fallback.
- Cada superfície: `createSurface{surfaceId, catalogId, sendDataModel:false}` + `updateComponents{surfaceId, components:[{id:"root", component:"<Nome>", ...props}]}` — UM componente raiz com id `root`, props planas no próprio objeto (sem data binding). `ACTIVITY_SNAPSHOT` continua com `activityType:"a2ui-surface"`, mesmos surfaceIds (`availability`, `booking-form`, `confirmation`, `reservations`).

## Tipos
```ts
type ReservationDTO = { id:string; courtName:string; date:string; dateLabel:string; startHour:number; durationHours:number;
  customerName:string; cpfMasked:string; sport:string; people:number; paymentMethod:'credito'|'debito'|'pix'|'dinheiro';
  paymentLabel:string; status:'pendente'|'confirmada'|'concluida'|'cancelada'; statusLabel:string };
```

## Componentes
1. **SlotGrid** `{ date, dateLabel, prevDate?:string, nextDate?:string, courts:[{id:number,name:string,sports:string[],slots:[{hour:number,free:boolean}]}] }`
   - slot livre → ação `select_slot` `{courtId,date,startHour}`; botões dia anterior/próximo → `change_date` `{date}`.
2. **BookingForm** `{ courtId, courtName, sports:string[], date, dateLabel, startHour, maxDuration:1|2|3, error?:string, defaults?:{name?,cpf?,phone?,sport?,people?,durationHours?,payment?} }`
   - Estado do formulário LOCAL no React (shadcn Input/Select/RadioGroup/ToggleGroup). Campos: Nome completo, CPF, Telefone (DDD), Esporte (Select), Qtd. pessoas (1–22), Duração (1–`maxDuration` h), Pagamento (Crédito/Débito/PIX/Dinheiro). Mostra `error` num Alert destructive.
   - Enviar → ação `submit_booking` `{courtId,date,startHour,name,cpf,phone,sport,people,durationHours,payment}` (`payment` ∈ credito|debito|pix|dinheiro; números podem ir como string). Botão secundário "Voltar à disponibilidade" → `change_date` `{date}`.
3. **ReservationCard** `{ title?:string, reservation:ReservationDTO, note?:string, canCancel:boolean }` — Card + Badge de status; se `canCancel`, botão "Cancelar reserva" (AlertDialog de confirmação) → `cancel_reservation` `{id}`.
4. **ReservationList** `{ title:string, reservations:ReservationDTO[], emptyText?:string }` — lista de ReservationCard compactos (mesma ação de cancelar quando status pendente/confirmada).

## Ações (inalteradas) — chegam em `input.forwardedProps.a2uiAction.userAction`
`{ name, surfaceId, sourceComponentId, context }`. Nomes: `select_slot`, `change_date`, `submit_booking`, `cancel_reservation`. O frontend deve disparar pelo mesmo mecanismo do renderer do CopilotKit (a2uiAction via copilotkit.runAgent) — o backend não muda o handler.
