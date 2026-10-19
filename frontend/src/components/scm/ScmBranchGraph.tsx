/*
 * Branch graph of the project checkout (Demo ScmView): every worktree lane forks off the base
 * and joins back at its HEAD, one row per unapplied commit, a dashed circle for uncommitted
 * changes. All data is Core's worktree inspection; a row opens that worktree.
 */
import type { AppCopy } from "../../lib/i18n/app-copy";
import { Icon } from "../primitives/Icon";

export type ScmGraphWorktree = {
  sessionId: string;
  branch: string;
  /** Uncommitted files, from Core's inspection. */
  dirty: number;
  /** Commit ids still waiting to be applied ("sha message…"), from Core's inspection. */
  commits: string[];
};

type Props = {
  baseBranch: string;
  baseHead?: string;
  worktrees: ScmGraphWorktree[];
  selected: string;
  labels: AppCopy;
  onSelectCheckout: (sessionId: string) => void;
};

const ROW_H = 34;
const LANE_W = 18;
const LANE_X0 = 14;
const laneColor = (lane: number) => (lane === 0 ? "var(--c1)" : `var(--c${((lane - 1) % 5) + 2})`);

type GraphRow =
  | { kind: "commit"; lane: number; sessionId: string; branch: string; sha: string; message: string }
  | { kind: "dirty"; lane: number; sessionId: string; branch: string; files: number }
  | { kind: "clean"; lane: number; sessionId: string; branch: string }
  | { kind: "base"; lane: 0 };

function commitParts(commit: string) {
  const sha = commit.slice(0, commit.indexOf(" ")) || commit;
  return { sha, message: commit.slice(sha.length).trim() };
}

function graphRows(worktrees: ScmGraphWorktree[]): GraphRow[] {
  const rows: GraphRow[] = [];
  worktrees.forEach((worktree, index) => {
    const lane = index + 1;
    if (worktree.dirty > 0) rows.push({ kind: "dirty", lane, sessionId: worktree.sessionId, branch: worktree.branch, files: worktree.dirty });
    worktree.commits.forEach((commit) => {
      const { sha, message } = commitParts(commit);
      rows.push({ kind: "commit", lane, sessionId: worktree.sessionId, branch: worktree.branch, sha, message });
    });
    if (worktree.dirty === 0 && worktree.commits.length === 0) {
      rows.push({ kind: "clean", lane, sessionId: worktree.sessionId, branch: worktree.branch });
    }
  });
  rows.push({ kind: "base", lane: 0 });
  return rows;
}

export function ScmBranchGraph({ baseBranch, baseHead, worktrees, selected, labels, onSelectCheckout }: Props) {
  const rows = graphRows(worktrees);
  const last = rows.length - 1;
  const lanes = worktrees.length + 1;
  const width = LANE_X0 * 2 + (lanes - 1) * LANE_W;
  const height = rows.length * ROW_H;
  const x = (lane: number) => LANE_X0 + lane * LANE_W;
  const y = (row: number) => row * ROW_H + ROW_H / 2;
  const firstRow = (lane: number) => rows.findIndex((row) => row.lane === lane);

  return (
    <div className="scm-graph" role="list" aria-label={labels.scmGraph}>
      <svg className="scm-graph-lanes" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        {/* Base history continues below its HEAD. */}
        <line x1={x(0)} y1={y(last)} x2={x(0)} y2={height} stroke={laneColor(0)} strokeWidth={2} strokeLinecap="round" />
        {worktrees.map((worktree, index) => {
          const lane = index + 1;
          const top = y(firstRow(lane));
          const join = y(last);
          const bend = join - ROW_H * 0.6;
          return (
            <path
              key={worktree.sessionId}
              fill="none"
              stroke={laneColor(lane)}
              strokeWidth={2}
              strokeLinecap="round"
              d={`M ${x(lane)} ${top} L ${x(lane)} ${bend} C ${x(lane)} ${join - ROW_H * 0.2}, ${x(0)} ${join - ROW_H * 0.35}, ${x(0)} ${join}`}
            />
          );
        })}
        {rows.map((row, index) => {
          const cx = x(row.lane);
          const cy = y(index);
          const color = laneColor(row.lane);
          if (row.kind === "dirty" || row.kind === "clean") {
            return (
              <circle
                key={index}
                cx={cx}
                cy={cy}
                r={4.5}
                fill="var(--surface-content-solid)"
                stroke={color}
                strokeWidth={1.75}
                strokeDasharray={row.kind === "dirty" ? "2.2 1.6" : undefined}
              />
            );
          }
          if (row.kind === "commit") {
            return <circle key={index} cx={cx} cy={cy} r={4.5} fill={color} stroke="var(--surface-content-solid)" strokeWidth={2} />;
          }
          return <circle key={index} cx={cx} cy={cy} r={5} fill={color} stroke="var(--surface-content-solid)" strokeWidth={2} />;
        })}
      </svg>
      <div className="scm-graph-rows" style={{ marginLeft: width }}>
        {rows.map((row, index) => {
          if (row.kind === "base") {
            return (
              <div key="base" role="listitem" className="scm-graph-row is-base" style={{ height: ROW_H }}>
                <span className="scm-ref" style={{ ["--lane" as string]: laneColor(0) }}><Icon name="local" size={11} />{baseBranch}</span>
                <span className="scm-graph-msg">{labels.scmHead}</span>
                <span className="scm-graph-sha mono">{baseHead || ""}</span>
              </div>
            );
          }
          return (
            <button
              key={`${row.sessionId}-${index}`}
              type="button"
              role="listitem"
              className={`scm-graph-row ${selected === row.sessionId ? "is-selected" : ""}`}
              style={{ height: ROW_H }}
              onClick={() => onSelectCheckout(row.sessionId)}
              title={row.branch}
            >
              {index === firstRow(row.lane) && (
                <span className="scm-ref" style={{ ["--lane" as string]: laneColor(row.lane) }}><Icon name="worktree" size={11} />{row.branch}</span>
              )}
              {row.kind === "commit" && (
                <>
                  <span className="scm-graph-msg">{row.message || row.sha}</span>
                  <span className="scm-tag is-pending">{labels.scmPendingTag}</span>
                  <span className="scm-graph-sha mono">{row.sha}</span>
                </>
              )}
              {row.kind === "dirty" && <span className="scm-graph-msg is-quiet">{labels.wtUncommitted} · {labels.scmFiles(row.files)}</span>}
              {row.kind === "clean" && <span className="scm-graph-msg is-quiet">{labels.scmNoCommits}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
