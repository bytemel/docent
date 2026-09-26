"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import { NAV } from "@/strings/nav";

interface State {
  failed: boolean;
  attempt: number;
}

export default class GoBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return <div key={this.state.attempt} className="flex flex-1 flex-col">{this.props.children}</div>;
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-16" role="alert">
        <h1 className="text-[28px] leading-[1.05] font-extrabold tracking-[-0.02em]">{NAV.crashedTitle}</h1>
        <p className="mt-3 text-[17px] text-ink-2">{NAV.crashed}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))}
          >
            {NAV.tryAgain}
          </button>
          <Link href="/" className="btn btn-lg">
            {NAV.home}
          </Link>
        </div>
      </div>
    );
  }
}
