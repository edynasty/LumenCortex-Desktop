export function splitCommandArgs(value: string): string[] {
  const matches = value.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return matches.map((item) =>
    item.startsWith('"') && item.endsWith('"')
      ? item.slice(1, -1)
      : item
  );
}

export function joinCommandArgs(args: string[] = []): string {
  return args
    .map((arg) => /\s/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg)
    .join(" ");
}
