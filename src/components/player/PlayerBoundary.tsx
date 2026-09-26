"use client";

import { Component, type ReactNode } from "react";
import type { RouteDoc } from "@/lib/types";
import { PLAYER } from "@/strings/player";
import { StaticView } from "./Panels";

interface Props {
  doc: RouteDoc;
  variant: "page" | "preview" | "embed";
  onClose?: () => void;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export default class PlayerBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <StaticView doc={this.props.doc} variant={this.props.variant} note={PLAYER.crashed} onClose={this.props.onClose} />
    );
  }
}
