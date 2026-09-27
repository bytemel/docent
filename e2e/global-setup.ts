import { rmSync } from "node:fs";
import { DEMO_DIR } from "./helpers";

export default function globalSetup() {
  rmSync(DEMO_DIR, { recursive: true, force: true });
}
