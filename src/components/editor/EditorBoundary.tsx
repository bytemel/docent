"use client";

import { Component, type ReactNode } from "react";
import { clearDraft } from "@/lib/draft";
import { t } from "@/strings/editor";

interface State {
  failed: boolean;
}

export default class EditorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  private restart = () => {
    clearDraft();
    window.location.replace("/new");
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="fixed inset-0 grid place-items-center bg-bg p-4">
        <section role="alert" className="panel flex max-w-sm flex-col gap-3 p-5">
          <h1 className="text-lg font-semibold text-ink">{t.brokenTitle}</h1>
          <p className="text-sm text-ink-2">{t.brokenBody}</p>
          <button type="button" className="btn btn-primary self-start" onClick={this.restart}>
            {t.resumeNew}
          </button>
        </section>
      </div>
    );
  }
}
