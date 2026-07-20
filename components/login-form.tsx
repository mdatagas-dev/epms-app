"use client";

import { useActionState } from "react";

import { loginAction } from "@/app/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="form-stack">
      <label className="field">
        <span>Username</span>
        <input name="username" type="text" autoComplete="username" placeholder="Username" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" placeholder="••••••••••••" required />
      </label>
      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
      <button type="submit" className="button button--primary button--full" disabled={pending}>
        <span>{pending ? "Memeriksa…" : "Masuk ke EPMS"}</span>
        <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
