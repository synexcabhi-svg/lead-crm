/**
 * Registers the email notifier on the lead event bus, exactly once per
 * process. Imported (for its side effect) by LeadService, which only runs in
 * the Node.js runtime - so nodemailer never enters the Edge bundle.
 */
import { onLeadEvent } from "@/lib/events";
import { notifyOnLeadEvent } from "./lead-notifications";

const g = globalThis as unknown as { __crmNotifyRegistered?: boolean };

if (!g.__crmNotifyRegistered) {
  g.__crmNotifyRegistered = true;
  onLeadEvent((event) => {
    // fire-and-forget: a notification must never block or break a lead write
    void notifyOnLeadEvent(event);
  });
  console.log("[notify] lead-assignment email notifier registered");
}
