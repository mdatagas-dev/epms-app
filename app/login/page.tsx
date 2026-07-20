import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="brand-lockup brand-lockup--login">
          <span className="brand-mark" aria-hidden="true">E</span>
          <div><strong>EPMS</strong><span>Process Engineering</span></div>
        </div>
        <div className="login-copy">
          <p className="eyebrow">Internal engineering system</p>
          <h1 id="login-title">ENGINEERING PROCESS MANAGEMENT SYSTEM</h1>
          <p>Time Study, Standard Time, Line Balance, dan capacity scenario dalam satu evidence chain.</p>
        </div>
        <LoginForm />
        <p className="login-help">Akun dibuat oleh Engineering Supervisor. Tidak ada registrasi publik.</p>
      </section>
      <aside className="login-aside" aria-label="System principles">
        <div className="login-grid" aria-hidden="true" />
        <div className="principle-card">
          <span className="mono-label">CONTROLLED DATA / 01</span>
          <p>Raw observation tetap tersimpan. Revisi yang disetujui menjadi immutable.</p>
        </div>
        <div className="aside-metric">
          <span>Standard formula</span>
          <strong>NT ÷ (1 − A)</strong>
          <small>Normal Time / Allowance</small>
        </div>
      </aside>
    </main>
  );
}
