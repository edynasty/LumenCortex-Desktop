type Props = {
  label: string;
  compact?: boolean;
};

export function LoadingState({ label, compact = false }: Props) {
  return (
    <div
      className={`desktop-loading-state ${compact ? "compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="desktop-loading-dots" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span>{label}</span>
    </div>
  );
}
