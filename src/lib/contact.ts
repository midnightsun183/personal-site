// Contact form rules, shared by the form (src/components/margins/ContactForm.tsx) and the Cloudflare Pages
// Function that sends it (functions/api/contact.ts). Relative imports only, so the Function's bundler can use it.

export type Field = "name" | "email" | "message";
export const FIELDS: Field[] = ["name", "email", "message"];

export const LIMITS: Record<Field, number> = { name: 100, email: 254, message: 5000 };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The problem with one field's value, in Corey's voice, or undefined when it's fine. */
export function check(field: Field, value: string): string | undefined {
  const v = value.trim();
  if (field === "name" && !v) return "Add your name, so I know who's writing.";
  if (field === "email" && !v) return "Add an email, so I can reply.";
  if (field === "email" && !EMAIL.test(v)) return "That email doesn't look right.";
  if (field === "message" && !v) return "Write something first.";
  if (v.length > LIMITS[field]) return `That's over ${LIMITS[field].toLocaleString("en-US")} characters. Trim it a little.`;
}

/** What /api/contact answers with. `code` lets the form react (reset the spam check, point at a field). */
export type ContactResponse =
  | { ok: true }
  | { ok: false; code: "invalid"; field: Field; message: string }
  | { ok: false; code: "turnstile" | "expired" | "send" | "bad-request"; message: string };
