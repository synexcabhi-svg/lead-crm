/**
 * GET /api/events - Server-Sent Events stream. The dashboard subscribes here
 * and refetches its data whenever a lead.* event arrives. If this connection
 * drops, the client falls back to interval polling (see useRealtime hook).
 */
import { requireUser } from "@/lib/auth";
import { onLeadEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireUser();

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      send({ type: "connected", at: new Date().toISOString() });

      const off = onLeadEvent((event) => {
        try {
          send(event);
        } catch {
          /* controller already closed */
        }
      });
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* noop */
        }
      }, 25_000);

      cleanup = () => {
        off();
        clearInterval(heartbeat);
      };
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
