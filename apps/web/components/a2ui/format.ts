export const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;
export const range = (start: number, dur: number) => `${pad(start)}–${pad(start + dur)}`;
export type Dispatch = ((action: unknown) => void) | undefined;
export const fire = (dispatch: Dispatch, name: string, context: Record<string, unknown>) =>
  dispatch?.({ event: { name, context } });
