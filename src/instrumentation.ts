/**
 * Intentionally empty. The lead-assignment email notifier is registered from
 * src/domain/notifications/register.ts, which is imported by LeadService - a
 * module that only ever executes in the Node.js runtime. Keeping nodemailer
 * out of this file avoids it being pulled into the Edge bundle.
 */
export async function register() {}
