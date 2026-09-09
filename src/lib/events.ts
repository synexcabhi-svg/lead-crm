/**
 * In-process event bus. LeadService emits here after every write; the SSE
 * endpoint (/api/events) subscribes and forwards to connected dashboards.
 *
 * This is deliberately simple - a single Node process. If the app is later
 * scaled to multiple instances, swap this module for Redis pub/sub or a
 * message broker; nothing else needs to change.
 */
import { EventEmitter } from "node:events";

export type LeadEventType =
  | "lead.created"
  | "lead.updated"
  | "lead.status_changed"
  | "lead.assigned"
  | "lead.tech_assigned"
  | "lead.archived"
  | "lead.deleted"
  | "lead.converted"
  | "deal.created"
  | "deal.updated"
  | "deal.stage_changed"
  | "deal.deleted"
  | "account.created";

export interface LeadEvent {
  type: LeadEventType;
  /** id of the lead this event concerns (lead.* events, and conversions) */
  leadId?: string;
  /** id of the deal this event concerns (deal.* events, and conversions) */
  dealId?: string;
  accountId?: string;
  at: string; // ISO timestamp
  actor: string; // actorLabel
  /** small hint payload so clients can decide what to refetch */
  changed?: string[];
}

const globalForBus = globalThis as unknown as { __crmBus?: EventEmitter };
const bus = globalForBus.__crmBus ?? new EventEmitter();
bus.setMaxListeners(0);
if (!globalForBus.__crmBus) globalForBus.__crmBus = bus;

const CHANNEL = "lead";

export function emitLeadEvent(event: LeadEvent): void {
  bus.emit(CHANNEL, event);
}

export function onLeadEvent(listener: (event: LeadEvent) => void): () => void {
  bus.on(CHANNEL, listener);
  return () => bus.off(CHANNEL, listener);
}
