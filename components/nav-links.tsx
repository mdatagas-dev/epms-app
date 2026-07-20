"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/icons";

const links = [
  { href: "/dashboard", label: "Overview", icon: "dashboard" as const },
  { href: "/time-studies", label: "Time Studies", icon: "study" as const },
  { href: "/motion-studies", label: "Motion Study", icon: "motion" as const },
  { href: "/line-balance", label: "Line Balance", icon: "balance" as const },
  { href: "/scenarios", label: "Capacity", icon: "scenario" as const },
  { href: "/instruction-translator", label: "IK Translator", icon: "translate" as const },
  { href: "/master-data", label: "Master Data", icon: "master" as const },
];

export function NavLinks({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  return <nav className="side-nav" aria-label="Primary navigation">
    {links.map((link) => {
      const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
      return <Link key={link.href} href={link.href} className="nav-link" aria-current={active ? "page" : undefined} onClick={onNavigate}>
        <Icon name={link.icon} /><span>{link.label}</span>{active && <span className="nav-indicator" />}
      </Link>;
    })}
  </nav>;
}
