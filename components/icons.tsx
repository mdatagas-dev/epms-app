type IconName = "dashboard" | "study" | "motion" | "balance" | "scenario" | "translate" | "master" | "arrow" | "clock" | "check" | "menu" | "close" | "sun" | "moon";

const paths: Record<IconName, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  study: <><path d="M9 3h6l1 3h3v15H5V6h3l1-3Z"/><path d="M9 12h6M9 16h6"/></>,
  motion: <><path d="M4 18c4-8 7-11 16-12"/><path d="m15 4 5 2-2 5"/><circle cx="6" cy="17" r="2"/></>,
  balance: <><path d="M4 19V8M10 19V4M16 19v-7M22 19H2"/></>,
  scenario: <><path d="M4 18 9 9l4 5 3-8 4 12"/><path d="M3 21h18"/></>,
  translate: <><path d="M4 5h7M7.5 3v2c0 4-2 7-5 9"/><path d="M4 9c1 2 3 4 6 5M13 20l4-10 4 10M14.5 17h5"/></>,
  master: <><path d="M4 4h16v5H4zM4 13h7v7H4zM15 13h5v7h-5z"/></>,
  arrow: <path d="m9 18 6-6-6-6"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
