type Tone = "neutral" | "success" | "warning" | "danger" | "info";

type Props = {
  label: string;
  tone?: Tone;
};

export function StatusIndicator({ label, tone = "neutral" }: Props) {
  return (
    <span className={`desktop-status ${tone}`}>
      <i aria-hidden />
      <span>{label}</span>
    </span>
  );
}
