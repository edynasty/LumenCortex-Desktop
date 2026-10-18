import { ICON_STROKE, Icons, type IconName } from "./icons";

/** One Lucide glyph per concept (see icons.ts), drawn at the shared stroke weight. */
export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  const Glyph = Icons[name];
  return <Glyph size={size} strokeWidth={ICON_STROKE} className={className} aria-hidden />;
}
