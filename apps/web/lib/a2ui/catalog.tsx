"use client";

import { createCatalog } from "@copilotkit/a2ui-renderer";
import { catalogDefinitions } from "./schemas";
import { CATALOG_ID } from "./catalog-id";
import { SlotGrid } from "@/components/a2ui/SlotGrid";
import { BookingForm } from "@/components/a2ui/BookingForm";
import { ReservationCard } from "@/components/a2ui/ReservationCard";
import { ReservationList } from "@/components/a2ui/ReservationList";

export const catalog = createCatalog(
  catalogDefinitions,
  {
    SlotGrid: ({ props, dispatch }) => <SlotGrid props={props as never} dispatch={dispatch} />,
    BookingForm: ({ props, dispatch }) => <BookingForm props={props as never} dispatch={dispatch} />,
    ReservationCard: ({ props, dispatch }) => <ReservationCard props={props as never} dispatch={dispatch} />,
    ReservationList: ({ props, dispatch }) => <ReservationList props={props as never} dispatch={dispatch} />,
  },
  { catalogId: CATALOG_ID, includeBasicCatalog: true },
);
