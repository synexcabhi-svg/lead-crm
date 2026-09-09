"use client";

/** Thin fetch wrapper for client components. Throws ApiClientError on non-2xx. */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const msg = body?.error?.message ?? `Request failed (${res.status})`;
    throw new ApiClientError(res.status, msg, body?.error?.details);
  }
  return (body?.data ?? body) as T;
}

/** Flatten a Zod `fieldErrors` object into { field: "first message" }. */
export function fieldErrors(details: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const fe = (details as { fieldErrors?: Record<string, string[]> })?.fieldErrors;
  if (fe) {
    for (const [k, v] of Object.entries(fe)) {
      if (Array.isArray(v) && v[0]) out[k] = v[0];
    }
  }
  return out;
}
