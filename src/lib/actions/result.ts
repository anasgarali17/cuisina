export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function fail<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

export function succeed<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}
