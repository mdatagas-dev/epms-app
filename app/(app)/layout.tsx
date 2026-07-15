import { logoutAction } from "@/app/actions";
import { NavLinks } from "@/components/nav-links";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">E</span><div><strong>EPMS</strong><span>Engineering evidence</span></div></div>
      <NavLinks />
      <div className="sidebar-foot">
        <div className="user-card"><span className="avatar">{user.name.slice(0, 1)}</span><div><strong>{user.name}</strong><span>{user.role === "supervisor" ? "Engineering Supervisor" : "Process Engineer"}</span></div></div>
        <form action={logoutAction}><button className="text-button">Keluar</button></form>
      </div>
    </aside>
    <div className="app-content">
      <header className="mobile-header"><div className="brand-lockup"><span className="brand-mark">E</span><strong>EPMS</strong></div><span className="status-dot">Internal</span></header>
      {children}
    </div>
  </div>;
}
