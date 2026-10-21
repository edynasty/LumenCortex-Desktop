import type { ConfigState, Session } from "../../types";
import { sessionUI } from "../../lib/session-ui";
import { useAgentCatalog } from "./useAgentCatalog";
import { useModelSelection } from "./useModelSelection";

type Options = {
  config: Pick<ConfigState, "model">;
  /** The open thread, or undefined on the new-task route. */
  session: Session | undefined;
  sessionId: string;
  /** The model the user last chose, already checked against the configured models. */
  preferred?: string;
  workspace: string;
};

/**
 * The composer's agent and model wiring. The catalog's selection is what Core will run, and the
 * model chip shows the same resolution (internal/agent/policy.go ResolveModelRef): the user's pick,
 * the thread's pin, the selected agent's first model, then the configured default. A child thread
 * keeps the agent Core pinned, so it is shown and never sent.
 */
export function useComposerAgents({ config, session, sessionId, preferred, workspace }: Options) {
  const agents = useAgentCatalog({
    sessionId,
    pinnedAgent: session?.agent,
    isChild: Boolean(session && sessionUI(session).parentSessionId),
    workspace,
    onAgentSelected: () => resetModelChoice(),
  });
  const { modelRef, selectModel, resetModelChoice, agentModelRef } = useModelSelection({
    config,
    session,
    sessionId,
    preferred,
    agentFirst: agents.selected?.models?.[0]?.model,
    agentSwitched: Boolean(session?.agent && session.agent !== agents.agentId),
  });
  return { agents, modelRef, selectModel, resetModelChoice, agentModelRef };
}
