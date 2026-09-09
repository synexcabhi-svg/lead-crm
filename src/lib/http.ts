/**
 * HTTP helpers shared by every route handler: typed errors, JSON envelopes,
 * and a `handle()` wrapper that turns thrown errors into proper responses.
 */
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (msg = "Bad request", details?: unknown) => new ApiError(400, msg, details);
export const unauthorized = (msg = "Authentication required") => new ApiError(401, msg);
export const forbidden = (msg = "Insufficient permissions") => new ApiError(403, msg);
export const notFound = (msg = "Not found") => new ApiError(404, msg);
export const conflict = (msg = "Conflict", details?: unknown) => new ApiError(409, msg, details);
export const tooManyRequests = (msg = "Too many requests") => new ApiError(429, msg);

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data }, { status: 200, ...init });
}
export function created<T>(data: T): Response {
  return Response.json({ data }, { status: 201 });
}
export function noContent(): Response {
  return new Response(null, { status: 204 });
}
export function fail(status: number, message: string, details?: unknown): Response {
  return Response.json({ error: { message, details } }, { status });
}

/**
 * Wrap a route handler body. Any ApiError / ZodError becomes a clean response;
 * anything else becomes a logged 500.
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) return fail(err.status, err.message, err.details);
    if (err instanceof ZodError) return fail(422, "Validation failed", err.flatten());
    console.error("[api] unhandled error:", err);
    return fail(500, "Internal server error");
  }
}
