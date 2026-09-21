export type IconName =
  | "menu"
  | "plus"
  | "folder"
  | "search"
  | "sliders"
  | "panel"
  | "play"
  | "stop"
  | "terminal"
  | "globe"
  | "chevron"
  | "spark";

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "menu":
      return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "folder":
      return <svg {...common}><path d="M3.5 7.5h6l2-2h9v13h-17z" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
    case "sliders":
      return <svg {...common}><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" /></svg>;
    case "panel":
      return <svg {...common}><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M15 4v16" /></svg>;
    case "play":
      return <svg {...common}><path d="m9 7 8 5-8 5z" /></svg>;
    case "stop":
      return <svg {...common}><rect x="8" y="8" width="8" height="8" rx="1" /></svg>;
    case "terminal":
      return <svg {...common}><path d="m5 7 4 5-4 5M11 17h8" /></svg>;
    case "globe":
      return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.3 2.3 3.5 5.1 3.5 8.5S14.3 18.2 12 20.5M12 3.5C9.7 5.8 8.5 8.6 8.5 12s1.2 6.2 3.5 8.5" /></svg>;
    case "chevron":
      return <svg {...common}><path d="m9 7 5 5-5 5" /></svg>;
    case "spark":
      return <svg {...common}><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></svg>;
  }
}
