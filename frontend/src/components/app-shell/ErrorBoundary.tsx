import { Component, type ErrorInfo, type ReactNode } from "react";
import { copy, initialLocale } from "../../lib/i18n/app-copy";
import { Button } from "../primitives/Button";

type State = { error: Error | null };

/**
 * Last line of defence: an uncaught render error would otherwise leave a blank window. It shows the
 * message (never state or user text) and a reload; runtime data is untouched because it lives in Core.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("render error", error.message, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const labels = copy[initialLocale()];
    return (
      <div className="fatal" role="alert">
        <strong>{labels.fatalTitle}</strong>
        <p>{labels.fatalHint}</p>
        <pre className="mono">{this.state.error.message}</pre>
        <Button onClick={() => window.location.reload()}>{labels.fatalReload}</Button>
      </div>
    );
  }
}
