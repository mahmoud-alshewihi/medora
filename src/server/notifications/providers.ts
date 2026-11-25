import { env } from "@/lib/env";

export interface OutboundEmail { to: string; subject: string; text: string }
export interface DeliveryResult { delivered: boolean; provider: string; detail?: string }
export interface EmailProvider { name: string; configured(): boolean; send(m: OutboundEmail): Promise<DeliveryResult> }

/** Resend over HTTPS. Only used if RESEND_API_KEY and EMAIL_FROM are set. */
export const resendProvider: EmailProvider = {
  name: "resend",
  configured: () => Boolean(env().RESEND_API_KEY && env().EMAIL_FROM),
  async send(m) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env().RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env().EMAIL_FROM, to: [m.to], subject: m.subject, text: m.text }),
    });
    return res.ok ? { delivered: true, provider: "resend" } : { delivered: false, provider: "resend", detail: `HTTP ${res.status}` };
  },
};

const providers: EmailProvider[] = [resendProvider];

/** Never reports delivery unless a configured provider confirmed it. */
export async function sendEmail(m: OutboundEmail): Promise<DeliveryResult> {
  const p = providers.find((x) => x.configured());
  if (!p) return { delivered: false, provider: "none", detail: "NOT_CONFIGURED: no email provider is configured; message not sent" };
  try { return await p.send(m); } catch (e) { return { delivered: false, provider: p.name, detail: String(e) }; }
}
export function registerEmailProvider(p: EmailProvider) { providers.unshift(p); }
