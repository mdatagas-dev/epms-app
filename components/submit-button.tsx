"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "button button--primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending}>{pending ? "Menyimpan…" : children}</button>;
}
