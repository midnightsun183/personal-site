// POST /api/contact on Cloudflare Pages: honeypot, field checks, Turnstile, then one email through Resend.
// Nothing is stored. Logs record what happened and when, never the message itself.
//
//   request ─▶ size/JSON ─▶ honeypot ─▶ fields ─▶ Turnstile siteverify ─▶ Resend ─▶ { ok: true }
//                 │400         │fake ok    │400         │403                  │502
//
// Environment (Cloudflare dashboard, encrypted): TURNSTILE_SECRET_KEY, RESEND_API_KEY,
// CONTACT_TO (Corey's inbox), CONTACT_FROM (a sender on a domain verified in Resend).
import { FIELDS, check, type ContactResponse, type Field } from "../../src/lib/contact.ts";

type Env = { TURNSTILE_SECRET_KEY: string; RESEND_API_KEY: string; CONTACT_TO: string; CONTACT_FROM: string };
type Context = { request: Request; env: Env };

const MAX_BODY_BYTES = 20_000;

function reply(body: ContactResponse, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function log(event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), route: "/api/contact", event, ...extra }));
}

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return reply({ ok: false, code: "bad-request", message: "That message is too long to send." }, 413);

  let data: Record<string, unknown>;
  try {
    data = await request.json();
  } catch {
    return reply({ ok: false, code: "bad-request", message: "Something went wrong reading the form. Try again." }, 400);
  }

  // Bots fill in the hidden field. Tell them it worked and send nothing.
  if (typeof data.website === "string" && data.website !== "") {
    log("honeypot");
    return reply({ ok: true }, 200);
  }

  const values = {} as Record<Field, string>;
  for (const field of FIELDS) {
    const value = typeof data[field] === "string" ? (data[field] as string) : "";
    const problem = check(field, value);
    if (problem) return reply({ ok: false, code: "invalid", field, message: problem }, 400);
    values[field] = value.trim();
  }

  // Turnstile: one check per token. timeout-or-duplicate means the token is too old or was already used.
  const token = typeof data.token === "string" ? data.token : "";
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET_KEY);
  form.append("response", token);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) form.append("remoteip", ip);
  let verdict: { success: boolean; "error-codes"?: string[] };
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    verdict = await res.json();
  } catch (err) {
    log("turnstile-unreachable", { error: String(err) });
    return reply({ ok: false, code: "send", message: "Didn't send. Try again in a minute." }, 502);
  }
  if (!verdict.success) {
    const codes = verdict["error-codes"] ?? [];
    log("turnstile-rejected", { codes });
    return codes.includes("timeout-or-duplicate")
      ? reply({ ok: false, code: "expired", message: "That took a while. Check the box and send again." }, 403)
      : reply({ ok: false, code: "turnstile", message: "The spam check didn't pass. Check the box and send again." }, 403);
  }

  // The visitor's name and email go in the body and reply_to only, never in a header line we build.
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.CONTACT_FROM,
        to: [env.CONTACT_TO],
        reply_to: values.email,
        subject: "New message from coreymacdonald.com",
        text: `From: ${values.name} <${values.email}>\n\n${values.message}`,
      }),
    });
    if (!res.ok) {
      log("send-failed", { status: res.status });
      return reply({ ok: false, code: "send", message: "Didn't send. Try again in a minute." }, 502);
    }
  } catch (err) {
    log("send-unreachable", { error: String(err) });
    return reply({ ok: false, code: "send", message: "Didn't send. Try again in a minute." }, 502);
  }

  log("sent", { length: values.message.length });
  return reply({ ok: true }, 200);
}
