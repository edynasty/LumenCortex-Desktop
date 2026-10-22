import { useEffect, useState } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { bridge } from "../../lib/bridge";
import type { AgentEntry, EffectivePrompt, PromptLayer } from "../../types";
import { agentName } from "../../app/agent-catalog";
import { groupTools, layerKindLabel, layerScopeLabel, policyLabel, reasonLabel } from "../../app/effective-prompt";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";

export type EffectivePromptPanelProps = {
  labels: AppCopy;
  /** The open workspace, "" when none is: Core has no Engine then, so there is no prompt to show. */
  workspace: string;
  /** The open session, "" for a first run: it adds the Task State block and the session's worktree. */
  sessionId: string;
  /** The agent being edited. Its policy and delegation are the host's grant, which Core narrows. */
  agent: AgentEntry;
  creating: boolean;
  /** The draft differs from the saved agent: Core describes the saved one. */
  dirty: boolean;
  trusted: boolean;
  trusting: boolean;
  onTrust: () => void;
};

/**
 * The prompt a run of this agent would send, as Core assembles it: every layer with its source and
 * whether it is loaded, and every tool grouped by where it comes from. Nothing here is assembled
 * on the Desktop side; the page shows Core's answer and can only refresh it or trust the workspace.
 */
export function EffectivePromptPanel({
  labels, workspace, sessionId, agent, creating, dirty, trusted, trusting, onTrust,
}: EffectivePromptPanelProps) {
  const [result, setResult] = useState<EffectivePrompt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloads, setReloads] = useState(0);
  const agentId = agent.id;

  useEffect(() => {
    if (!workspace || creating || !agentId) {
      setResult(null);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    bridge.effectivePrompt({
      sessionId: sessionId || undefined,
      agent: agentId,
      policy: agent.policy,
      delegation: agent.delegation,
      // A delegation-only agent is described as the child it would be, not as a conversation turn.
      interactive: agent.use !== "delegation",
    })
      .then((next) => {
        if (!cancelled) setResult(next);
      })
      .catch((failure) => {
        if (!cancelled) setError(failure instanceof Error ? failure.message : String(failure));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // A trusted workspace changes what Core loads, and a different grant changes the tool list.
  }, [workspace, sessionId, agentId, agent.policy, agent.delegation, agent.use, trusted, reloads]);

  if (!workspace) {
    return <p className="agents-note">{labels.promptNoProject}</p>;
  }
  if (creating || !agentId) {
    return <p className="agents-note">{labels.promptSaveFirst}</p>;
  }

  return (
    <div className="agents-prompt">
      <p className="agents-note">{labels.promptIntro}</p>

      <div className="agents-prompt-head">
        <div className="agents-prompt-meta">
          <code className="mono agents-prompt-path" title={workspace}>{workspace}</code>
          <span className={trusted ? "tag" : "tag is-warn"}>{trusted ? labels.promptTrusted : labels.promptUntrusted}</span>
        </div>
        <div className="agents-prompt-actions">
          <Button
            size="sm"
            variant="ghost"
            disabled={loading}
            aria-label={labels.promptRefresh}
            title={labels.promptRefresh}
            onClick={() => setReloads((count) => count + 1)}
          >
            <Icon name="retry" size={13} />
          </Button>
          {!trusted && (
            <Button size="sm" variant="secondary" disabled={trusting} onClick={onTrust}>
              {trusting ? labels.configTrusting : labels.configTrustWorkspace}
            </Button>
          )}
        </div>
      </div>

      {!trusted && <p className="agents-note agents-locked">{labels.promptUntrustedHint}</p>}
      {dirty && <p className="agents-note">{labels.promptDirtyNote}</p>}

      {error && (
        <p className="agents-error" role="alert">
          <Icon name="failed" size={13} />
          <span>{labels.promptLoadFailed}{error}</span>
        </p>
      )}
      {loading && !result && <p className="agents-note">{labels.promptLoading}</p>}

      {result && (
        <>
          <p className="agents-prompt-summary">
            <span>{labels.promptAgent} · <strong>{agentName(agent, labels)}</strong></span>
            <span>{labels.promptPolicy} · <strong>{policyLabel(result.policy, labels)}</strong></span>
          </p>

          {result.warnings?.length ? (
            <section className="agents-prompt-warnings" aria-label={labels.promptWarnings}>
              <strong>{labels.promptWarnings}</strong>
              <ul>
                {result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
              </ul>
            </section>
          ) : null}

          <h5 className="subhead">{labels.promptLayers}</h5>
          {result.layers.length === 0 ? (
            <p className="agents-note">{labels.promptEmpty}</p>
          ) : (
            <ul className="agents-prompt-layers" aria-label={labels.promptLayers}>
              {result.layers.map((layer, index) => (
                <PromptLayerRow key={`${layer.kind}-${index}`} layer={layer} labels={labels} />
              ))}
            </ul>
          )}

          <h5 className="subhead">{labels.promptTools}</h5>
          <div className="agents-prompt-tool-groups">
            {groupTools(result.tools, labels).map((group) => (
              <section className="agents-prompt-tool-group" key={group.source} aria-label={group.label}>
                <div className="agents-prompt-tool-head">
                  <strong>{group.label}</strong>
                  <span className="agents-note">{group.tools.length}</span>
                </div>
                <ul>
                  {group.tools.map((tool) => (
                    <li className="agents-prompt-tool" key={tool.name}>
                      <code className="mono">{tool.name}</code>
                      <span className="tag">{tool.permission}</span>
                      <span className={tool.included ? "tag" : "tag is-off"}>
                        {tool.included ? labels.promptToolsIncluded : labels.promptToolsExcluded}
                      </span>
                      {!tool.included && tool.reason ? (
                        <span className="agents-note agents-prompt-reason">
                          {labels.promptReason} · {reasonLabel(tool.reason, labels)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** One layer, collapsed by default: its kind, source, scope and size, then its text. */
function PromptLayerRow({ layer, labels }: { layer: PromptLayer; labels: AppCopy }) {
  return (
    <li>
      <details className={`agents-prompt-layer${layer.included ? "" : " is-excluded"}`}>
        <summary>
          <span className="agents-prompt-layer-kind">{layerKindLabel(layer.kind, labels)}</span>
          <span className={layer.included ? "tag" : "tag is-off"}>
            {layer.included ? labels.promptIncluded : labels.promptNotLoaded}
          </span>
          {layer.source ? (
            <code className="mono agents-prompt-layer-source" title={layer.source}>{layer.source}</code>
          ) : null}
          {layer.scope ? <span className="agents-note">{layerScopeLabel(layer.scope, labels)}</span> : null}
          <span className="agents-note">{labels.promptBytes.replace("{bytes}", String(layer.bytes))}</span>
        </summary>
        <div className="agents-prompt-layer-body">
          {!layer.included && layer.reason ? (
            <p className="agents-note">
              {labels.promptReason} · {reasonLabel(layer.reason, labels)}
            </p>
          ) : null}
          {layer.truncated ? <p className="agents-note">{labels.promptTruncated}</p> : null}
          {layer.warning ? (
            <p className="agents-note">{labels.promptWarning} · {layer.warning}</p>
          ) : null}
          {layer.included && layer.text ? <pre className="agents-prompt-text">{layer.text}</pre> : null}
        </div>
      </details>
    </li>
  );
}
