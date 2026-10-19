/*
 * File path as the Demo's PathLabel: dim directory part, bright basename, middle ellipsis
 * for long directories (`.path` / `.path-dir` / `.path-name` in base.css). The directory is
 * isolated in <bdi> so the right-to-left ellipsis keeps its trailing slash in place.
 */
export function PathLabel({ path }: { path: string }) {
  const parts = path.replace(/\\/g, "/").split("/");
  const name = parts.pop() || path;
  const dir = parts.join("/");
  return (
    <span className="path">
      {dir && <span className="path-dir"><bdi>{dir}/</bdi></span>}
      <span className="path-name">{name}</span>
    </span>
  );
}
