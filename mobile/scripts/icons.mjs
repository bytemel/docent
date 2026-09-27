import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const res = join(root, "android/app/src/main/res");
const ios = join(root, "ios/App/App/Assets.xcassets");
const YELLOW = "#ffc61a";
const INK = "#101214";
const STEM = "M10.5 25V17.5C10.5 14.46 12.96 12 16 12H19";
const HEAD = "M18.5 6.8L25.4 12L18.5 17.2Z";

const glyph = (color) =>
  `<path d="${STEM}" fill="none" stroke="${color}" stroke-width="3.4" stroke-linecap="round"/>` +
  `<path d="${HEAD}" fill="${color}" stroke="${color}" stroke-width="1.2" stroke-linejoin="round"/>`;

const square = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${YELLOW}"/>${glyph(INK)}</svg>`;
const round = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="${YELLOW}"/><g transform="translate(16 16) scale(0.86) translate(-16.5 -16)">${glyph(INK)}</g></svg>`;
const foreground = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><g transform="translate(54 54) scale(2.3) translate(-17.95 -15.9)">${glyph(INK)}</g></svg>`;
const splash = (w, h) => {
  const s = Math.min(w, h) * 0.24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${INK}"/><g transform="translate(${(w - s) / 2} ${(h - s) / 2}) scale(${s / 32})"><rect width="32" height="32" rx="7" fill="${YELLOW}"/>${glyph(INK)}</g></svg>`;
};

function render(svg, width) {
  return new Resvg(svg, { fitTo: { mode: "width", value: width }, background: "rgba(0,0,0,0)" }).render().asPng();
}

function pngSize(file) {
  const b = readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
let count = 0;
for (const [d, k] of Object.entries(DENSITY)) {
  const dir = join(res, `mipmap-${d}`);
  writeFileSync(join(dir, "ic_launcher.png"), render(square(), 48 * k));
  writeFileSync(join(dir, "ic_launcher_round.png"), render(round(), 48 * k));
  writeFileSync(join(dir, "ic_launcher_foreground.png"), render(foreground(), 108 * k));
  count += 3;
}
for (const name of readdirSync(res)) {
  const file = join(res, name, "splash.png");
  try {
    statSync(file);
  } catch {
    continue;
  }
  const [w, h] = pngSize(file);
  writeFileSync(file, render(splash(w, h), w));
  count++;
}
writeFileSync(
  join(res, "values/ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFC61A</color>\n</resources>\n`,
);
writeFileSync(
  join(res, "drawable/ic_tracking.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="32"
    android:viewportHeight="32">
    <path
        android:pathData="${STEM}"
        android:strokeColor="#FFFFFFFF"
        android:strokeWidth="3.4"
        android:strokeLineCap="round" />
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="${HEAD}"
        android:strokeColor="#FFFFFFFF"
        android:strokeWidth="1.2"
        android:strokeLineJoin="round" />
</vector>
`,
);
try {
  writeFileSync(join(ios, "AppIcon.appiconset/AppIcon-512@2x.png"), render(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${YELLOW}"/>${glyph(INK)}</svg>`, 1024));
  for (const f of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    writeFileSync(join(ios, "Splash.imageset", f), render(splash(2732, 2732), 2732));
  }
  count += 4;
} catch {
  console.log("iOS assets skipped");
}
console.log(`Wrote ${count} images`);
