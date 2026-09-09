/**
 * Email transport. Three modes via MAIL_TRANSPORT:
 *   console (default) - prints the message to the server console, no setup
 *   smtp              - real delivery via SMTP_* settings
 *   off               - drop silently
 *
 * sendMail never throws to its caller - a failed notification must not break
 * the lead operation that triggered it.
 */
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/config/env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let cached: Transporter | null = null;

function transporter(): Transporter {
  if (cached) return cached;
  const { smtp } = env.mail;
  cached = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
  return cached;
}

export async function sendMail(msg: MailMessage): Promise<{ ok: boolean; skipped?: string }> {
  const mode = env.mail.transport;

  if (mode === "off") return { ok: false, skipped: "MAIL_TRANSPORT=off" };
  if (!msg.to) return { ok: false, skipped: "no recipient address" };

  if (mode === "console") {
    console.log(
      [
        "",
        "──────────── EMAIL (MAIL_TRANSPORT=console) ────────────",
        `From:    ${env.mail.from}`,
        `To:      ${msg.to}`,
        `Subject: ${msg.subject}`,
        "",
        msg.text,
        "───────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { ok: true };
  }

  try {
    await transporter().sendMail({
      from: env.mail.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[mailer] SMTP send failed:", err);
    return { ok: false, skipped: "smtp error" };
  }
}
