import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const RESULTS = path.join(ROOT, "test-results", "results.json");
const DEMO = path.join(ROOT, "test-results", "demo");
const OUT_DIR = path.join(ROOT, "reports");
const MAX_SHOTS = 6;

const FLOWS = [
  { key: "home", file: "home.spec.ts", title: "The home page", story: "A visitor lands on Docent, sees what it does and the three ways in, and hears a direction plate read out." },
  { key: "go", file: "go.spec.ts", title: "Get directions", story: "Someone searches for Sarit Centre, picks a route option, starts, and walks the whole way while the plate counts down and the voice talks them to the gate." },
  { key: "new", file: "new.spec.ts", title: "Share a route", story: "A host makes Westlands to Kangemi, compares route options, switches a leg to matatu, checks the spoken directions and sends one link." },
  { key: "r", file: "r.spec.ts", title: "Open a shared route", story: "The guest opens the link, sees the overview, watches the route with voice, changes the map view and reaches the end card." },
  { key: "here", file: "here.spec.ts", title: "Share where I am", story: "A guest sends their location back with an accuracy reading and a note. When location is blocked, the page explains how to turn it on." },
  { key: "live", file: "live.spec.ts", title: "Live location", story: "A live link opens the watch screen, or explains that live sharing is off." },
  { key: "platform", file: "api.spec.ts", title: "API and platform", story: "Routing, search, security headers, broken links, the 404 page, the service worker, the manifest and share images." },
  { key: "offline", file: "offline.spec.ts", title: "Works offline", story: "A route opened once is saved on the phone and still plays with the network switched off." },
  { key: "layout", file: "layout.spec.ts", title: "Layout on phone and desktop", story: "Every page at 390 and 1280 pixels wide: nothing scrolls sideways and the console stays clean." },
];

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function collect(suite, file, out) {
  const f = suite.file ?? file;
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const last = t.results?.[t.results.length - 1];
      const status = t.status === "skipped" ? "skipped" : t.status === "expected" || t.status === "flaky" ? "passed" : "failed";
      out.push({
        file: path.basename(spec.file ?? f ?? ""),
        title: [...(suite.title && !suite.title.endsWith(".ts") ? [suite.title] : []), spec.title].join(" › "),
        status,
        flaky: t.status === "flaky",
        error: last?.error?.message ? last.error.message.replace(/\u001b\[[0-9;]*m/g, "").split("\n").slice(0, 4).join(" ") : "",
      });
    }
  }
  for (const child of suite.suites ?? []) collect({ ...child, title: [suite.title, child.title].filter((x) => x && !x.endsWith(".ts")).join(" › ") }, f, out);
}

function shrink(file) {
  try {
    const dir = mkdtempSync(path.join(tmpdir(), "docent-report-"));
    const out = path.join(dir, "s.jpg");
    execFileSync("sips", ["-Z", "1000", "-s", "format", "jpeg", "-s", "formatOptions", "58", file, "--out", out], { stdio: "ignore" });
    return readFileSync(out);
  } catch {
    return readFileSync(file);
  }
}

function pick(list, n) {
  if (list.length <= n) return list;
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[Math.round((i * (list.length - 1)) / (n - 1))]);
  return [...new Set(out)];
}

function readJson(file, fallback) {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback;
}

if (!existsSync(RESULTS)) {
  console.error("No test-results/results.json. Run npm run e2e first.");
  process.exit(1);
}

const results = readJson(RESULTS, {});
const tests = [];
for (const s of results.suites ?? []) collect(s, s.file, tests);
const passed = tests.filter((t) => t.status === "passed").length;
const failed = tests.filter((t) => t.status === "failed").length;
const skipped = tests.filter((t) => t.status === "skipped").length;
const baseURL = process.env.E2E_BASE_URL ?? results.config?.projects?.[0]?.use?.baseURL ?? "http://localhost:3000";
let commit = "unknown";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
} catch {}
const now = new Date();
const date = now.toISOString().slice(0, 10);
const when = now.toLocaleString("en-GB", { timeZone: "Africa/Nairobi", dateStyle: "long", timeStyle: "short" });

const sections = FLOWS.map((flow, i) => {
  const own = tests.filter((t) => t.file === flow.file);
  const ok = own.length > 0 && own.every((t) => t.status !== "failed");
  const dir = path.join(DEMO, flow.key);
  const shots = pick(readJson(path.join(dir, "shots.json"), []).filter((s) => existsSync(path.join(dir, s.file))), MAX_SHOTS);
  const spoken = readJson(path.join(dir, "spoken.json"), []);
  const figures = shots
    .map((s) => {
      const data = shrink(path.join(dir, s.file)).toString("base64");
      return `<figure><img loading="lazy" alt="${esc(s.caption)}" src="data:image/jpeg;base64,${data}"><figcaption>${esc(s.caption)}</figcaption></figure>`;
    })
    .join("");
  const voice = spoken.length
    ? `<div class="voice"><h4>What Docent said</h4>${spoken
        .map((g) => `<p class="vlabel">${esc(g.label)}</p><ol>${g.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ol>`)
        .join("")}</div>`
    : "";
  const rows = own
    .map(
      (t) =>
        `<li class="${t.status}"><span class="badge">${t.status === "passed" ? (t.flaky ? "Passed on retry" : "Passed") : t.status === "skipped" ? "Skipped" : "Failed"}</span><span>${esc(t.title)}${
          t.error ? `<small>${esc(t.error)}</small>` : ""
        }</span></li>`,
    )
    .join("");
  return `<section class="flow">
  <header class="plate"><span class="n">${String(i + 1).padStart(2, "0")}</span><div><h2>${esc(flow.title)}</h2><p>${esc(flow.story)}</p></div><span class="state ${ok ? "ok" : "bad"}">${ok ? "Pass" : own.length ? "Fail" : "Not run"}</span></header>
  <ul class="checks">${rows || "<li>No tests ran for this flow.</li>"}</ul>
  ${figures ? `<div class="shots">${figures}</div>` : ""}
  ${voice}
</section>`;
}).join("\n");

const failures = tests.filter((t) => t.status === "failed");
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Docent demo report, ${esc(date)}</title>
<style>
:root{--bg:#f3f4f1;--surface:#fff;--surface-2:#e9ebe6;--ink:#101214;--ink-2:#3f444b;--ink-3:#5e646c;--line:#d9dcd5;--accent:#ffc61a;--ok:#1f7a4d;--danger:#b42318}
@media (prefers-color-scheme:dark){:root{--bg:#0d0f11;--surface:#16191c;--surface-2:#20242a;--ink:#f2f3f0;--ink-2:#c9cdd2;--ink-3:#9aa1a9;--line:#2c3238;--ok:#4ade80;--danger:#f97066}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Overpass,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1120px;margin:0 auto;padding:40px 20px 80px}
h1{font-size:44px;line-height:1.04;letter-spacing:-.02em;font-weight:900;margin:0 0 8px}
.lead{color:var(--ink-2);font-size:18px;max-width:60ch;margin:0 0 28px}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:32px}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px}
.stat b{display:block;font:700 30px/1 ui-monospace,Menlo,monospace}.stat span{color:var(--ink-3);font-size:14px}
.stat.go b{color:var(--ok)}.stat.stop b{color:var(--danger)}
.meta{font:13px/1.6 ui-monospace,Menlo,monospace;color:var(--ink-2);background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:36px;word-break:break-all}
.flow{margin:0 0 44px}
.plate{display:flex;gap:16px;align-items:flex-start;background:var(--ink);color:var(--bg);border-radius:18px;padding:18px}
.plate .n{flex:none;display:grid;place-items:center;width:52px;height:52px;border-radius:14px;background:var(--accent);color:#101214;font:800 22px ui-monospace,Menlo,monospace}
.plate h2{margin:2px 0 4px;font-size:24px;letter-spacing:-.01em}.plate p{margin:0;opacity:.8;max-width:70ch}.plate div{flex:1}
.state{flex:none;border-radius:10px;padding:6px 10px;font-weight:800;font-size:14px}.state.ok{background:var(--accent);color:#101214}.state.bad{background:var(--danger);color:#fff}
.checks{list-style:none;padding:0;margin:12px 0}.checks li{display:flex;gap:10px;align-items:flex-start;padding:8px 2px;border-bottom:1px solid var(--line)}
.checks small{display:block;color:var(--danger);font-size:13px;margin-top:2px}
.badge{flex:none;font-size:12px;font-weight:800;border-radius:8px;padding:2px 8px;background:var(--surface-2)}
.passed .badge{background:var(--accent);color:#101214}.failed .badge{background:var(--danger);color:#fff}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-top:14px}
figure{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden}
img{display:block;width:100%;height:auto}figcaption{padding:10px 12px;font-size:14px;color:var(--ink-2)}
.voice{margin-top:14px;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:14px 18px}
.voice h4{margin:0 0 6px}.vlabel{margin:10px 0 4px;font-weight:700;color:var(--ink-2)}.voice ol{margin:0;padding-left:22px}.voice li{padding:2px 0}
.fails{background:var(--surface);border:1.5px solid var(--danger);border-radius:18px;padding:14px 18px;margin-bottom:36px}
.fails h2{margin:0 0 6px;font-size:20px}
</style></head><body><main>
<h1>${failed ? "Docent end to end check" : "Docent works end to end"}</h1>
<p class="lead">Every promise on the site, checked in a real Chrome browser against ${esc(baseURL)}. Each flow below shows what was tested, screenshots from the run and the lines Docent spoke.</p>
<div class="summary">
<div class="stat go"><b>${passed}</b><span>checks passed</span></div>
<div class="stat ${failed ? "stop" : ""}"><b>${failed}</b><span>checks failed</span></div>
<div class="stat"><b>${skipped}</b><span>skipped</span></div>
<div class="stat"><b>${FLOWS.length}</b><span>flows</span></div>
</div>
<div class="meta">Site: ${esc(baseURL)}<br>Run: ${esc(when)} (Nairobi time)<br>Commit: ${esc(commit)}<br>Browser: Google Chrome, driven by Playwright</div>
${failures.length ? `<div class="fails"><h2>What failed</h2><ul>${failures.map((f) => `<li><b>${esc(f.title)}</b>: ${esc(f.error)}</li>`).join("")}</ul></div>` : ""}
${sections}
</main></body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
const out = path.join(OUT_DIR, `docent-demo-${date}.html`);
writeFileSync(out, html);
const mb = (statSync(out).size / 1024 / 1024).toFixed(1);
console.log(`Wrote ${out} (${mb} MB): ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (!existsSync(DEMO) || !readdirSync(DEMO).length) console.log("No screenshots were found.");
