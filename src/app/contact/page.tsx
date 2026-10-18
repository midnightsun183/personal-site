import type { Metadata } from "next";
import ContactForm from "@/components/margins/ContactForm";
import { Aside } from "@/components/margins/Note";
import s from "@/components/margins/margins.module.css";

export const metadata: Metadata = {
  title: "Write to me",
  description: "A note, a question, a correction.",
};

export default function ContactPage() {
  return (
    <>
      <h1 className={`${s.postTitle} ${s.indexTitle}`}>Write to me</h1>
      <p className={s.postDek}>A note, a question, a correction. I read everything and answer most of it.</p>
      <div>
        <ContactForm />
      </div>
      <Aside>Your email is only used to write back. Nothing else is kept.</Aside>
    </>
  );
}
