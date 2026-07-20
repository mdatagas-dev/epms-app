"use client";

import { useRef } from "react";

import { logoutAction } from "@/app/actions";
import { Icon } from "@/components/icons";
import { NavLinks } from "@/components/nav-links";

export function MobileNavigation({ name, role }: { name: string; role: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const roleLabel = role === "supervisor" ? "Engineering Supervisor" : "Process Engineer";

  return <>
    <header className="mobile-header">
      <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">E</span><strong>EPMS</strong></div>
      <button className="mobile-menu-button" type="button" aria-label="Buka menu navigasi" onClick={() => dialogRef.current?.showModal()}><Icon name="menu" size={20} /></button>
    </header>
    <dialog ref={dialogRef} className="mobile-drawer" aria-labelledby="mobile-menu-title">
      <div className="mobile-drawer-head">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">E</span><div><strong id="mobile-menu-title">EPMS</strong><span>Engineering evidence</span></div></div>
        <button className="mobile-menu-button" type="button" aria-label="Tutup menu navigasi" onClick={() => dialogRef.current?.close()}><Icon name="close" size={20} /></button>
      </div>
      <NavLinks onNavigate={() => dialogRef.current?.close()} />
      <div className="mobile-drawer-foot">
        <div className="user-card"><span className="avatar">{name.slice(0, 1)}</span><div><strong>{name}</strong><span>{roleLabel}</span></div></div>
        <form action={logoutAction}><button type="submit" className="text-button">Keluar</button></form>
      </div>
    </dialog>
  </>;
}
