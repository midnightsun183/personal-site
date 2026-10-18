"use client";

import { useEffect, useRef, useState, type FocusEvent, type FormEvent } from "react";
import { FIELDS, LIMITS, check, type ContactResponse, type Field } from "@/lib/contact";
import s from "./margins.module.css";

type Errors = Partial<Record<Field, string>>;
type Phase = "idle" | "sending" | "sent";
/** loading → ready, or blocked (script never arrived) / unconfigured (no site key in this build). */
type Spam = "loading" | "ready" | "blocked" | "unconfigured";

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const BLOCKED_AFTER_MS = 10_000;

const LABELS: Record<Field, string> = { name: "Your name", email: "Email, so I can reply", message: "Message" };
const UNSENT = "Didn't send. Try again in a minute.";

/** "Write to me" form. Checks each field when you leave it, everything again on send, and posts to /api/contact. */
export default function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [spam, setSpam] = useState<Spam>(SITE_KEY ? "loading" : "unconfigured");
  const [token, setToken] = useState("");
  const [messageLength, setMessageLength] = useState(0);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  // Load Turnstile once, render the check, and give up after BLOCKED_AFTER_MS (content blockers stop the script).
  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile || !widget.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(widget.current, {
        sitekey: SITE_KEY,
        callback: (t: string) => setToken(t),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
      setSpam("ready");
    };
    if (window.turnstile) render();
    else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
    }
    const timer = setTimeout(() => {
      if (!cancelled && !widgetId.current) setSpam("blocked");
    }, BLOCKED_AFTER_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  function resetSpamCheck() {
    setToken("");
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }

  function onBlur(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const field = e.target.name as Field;
    setErrors((prev) => ({ ...prev, [field]: check(field, e.target.value) }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const value = (f: string) => (form.elements.namedItem(f) as HTMLInputElement | HTMLTextAreaElement).value;

    const next: Errors = {};
    for (const f of FIELDS) next[f] = check(f, value(f));
    setErrors(next);
    const first = FIELDS.find((f) => next[f]);
    if (first) {
      (form.elements.namedItem(first) as HTMLElement).focus();
      return;
    }
    if (spam === "blocked") return;
    if (!token) {
      setStatus("Check the box above the button first.");
      return;
    }

    setPhase("sending");
    setStatus("");
    let body: ContactResponse;
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: value("name"), email: value("email"), message: value("message"), website: value("website"), token }),
      });
      body = res.headers.get("content-type")?.includes("application/json")
        ? await res.json()
        : { ok: false, code: "send", message: UNSENT };
    } catch {
      body = { ok: false, code: "send", message: UNSENT };
    }

    if (body.ok) {
      setPhase("sent");
      setStatus("Thanks. I'll write back.");
      return;
    }
    setPhase("idle");
    setStatus(body.message);
    if (body.code === "invalid") setErrors((prev) => ({ ...prev, [body.field]: body.message }));
    // A token works once, so any failed send needs a fresh check.
    resetSpamCheck();
  }

  const sent = phase === "sent";

  return (
    <form className={s.form} onSubmit={onSubmit} noValidate>
      {FIELDS.map((field) => {
        const id = `contact-${field}`;
        const err = errors[field];
        const counterId = `${id}-count`;
        const nearLimit = field === "message" && messageLength > LIMITS.message * 0.9;
        const describedBy = [err && `${id}-error`, nearLimit && counterId].filter(Boolean).join(" ") || undefined;
        const props = {
          id,
          name: field,
          required: true,
          maxLength: LIMITS[field],
          onBlur,
          readOnly: sent,
          "aria-invalid": err ? true : undefined,
          "aria-describedby": describedBy,
        };
        return (
          <div className={s.field} key={field}>
            <label htmlFor={id}>{LABELS[field]}</label>
            {field === "message" ? (
              <textarea {...props} onChange={(e) => setMessageLength(e.target.value.length)} />
            ) : (
              <input {...props} type={field === "email" ? "email" : "text"} autoComplete={field} />
            )}
            {nearLimit && (
              <p className={s.counter} id={counterId}>
                {messageLength.toLocaleString("en-US")} of {LIMITS.message.toLocaleString("en-US")} characters
              </p>
            )}
            {err && (
              <p className={s.error} id={`${id}-error`}>
                {err}
              </p>
            )}
          </div>
        );
      })}
      <div className={s.trap} aria-hidden="true">
        <label htmlFor="contact-website">Leave this empty</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className={s.spam} ref={widget} />
      {spam === "blocked" && (
        <p className={s.error}>
          The spam check didn&apos;t load, so this form can&apos;t send. A content blocker or privacy setting may be
          stopping it. Try another browser, or allow challenges.cloudflare.com for this site.
        </p>
      )}
      {spam === "unconfigured" && <p className={s.status}>The spam check isn&apos;t set up in this build, so sending is off.</p>}

      <button className={s.send} type="submit" disabled={phase !== "idle" || spam === "blocked" || spam === "unconfigured"}>
        {sent ? "Message sent" : phase === "sending" ? "Sending…" : "Send message"}
      </button>
      <p className={s.status} role="status" aria-live="polite">
        {status}
      </p>
    </form>
  );
}
