// Usage: node screenshot.mjs <url> [label] [--mobile]
// Saves to ./temporary screenshots/screenshot-N[-label].png (auto-incremented)
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readdirSync } from "fs";
import path from "path";
import { execSync } from "child_process";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--")) || "http://localhost:3000";
const label = args.filter((a) => !a.startsWith("--"))[1] || "";
const mobile = args.includes("--mobile");

const outDir = path.resolve("./temporary screenshots");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const existing = readdirSync(outDir).filter((f) => /^screenshot-\d+/.test(f));
const nextN =
  existing.reduce((max, f) => {
    const m = f.match(/^screenshot-(\d+)/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0) + 1;

const suffix = label ? `-${label}` : "";
const outPath = path.join(outDir, `screenshot-${nextN}${suffix}.png`);

function findChromiumExecutable() {
  const cacheDir = path.join(
    process.env.HOME,
    "Library/Caches/ms-playwright"
  );
  if (!existsSync(cacheDir)) return null;
  const dirs = readdirSync(cacheDir).filter((d) => d.startsWith("chromium-") && !d.includes("headless"));
  if (!dirs.length) return null;
  dirs.sort();
  const chromeDir = dirs[dirs.length - 1];
  return path.join(cacheDir, chromeDir, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium");
}

const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 };

const launchOpts = {};
const execPath = findChromiumExecutable();
if (execPath && existsSync(execPath)) {
  launchOpts.executablePath = execPath;
}

// deviceScaleFactor kept at 1: on a long mobile page, 2x can push the
// full-page capture height past Chromium's internal screenshot size limit
// and silently truncate content.
const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });

// Reduced motion makes scroll-triggered reveal elements render at their
// final (visible) state immediately, via this site's own CSS fallback —
// avoids both waiting on IntersectionObserver timing and scroll/backdrop
// -filter repaint artifacts from simulating a manual scroll pass.
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(url, { waitUntil: "networkidle" });

// Scroll through so native loading="lazy" images actually fire before capture.
await page.evaluate(async () => {
  const step = Math.max(300, window.innerHeight);
  let y = 0;
  const max = document.body.scrollHeight;
  while (y < max) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 60));
    y += step;
  }
  window.scrollTo(0, 0);
});

// Wait for every image to finish loading (covers lazy images now in the DOM).
await page.waitForFunction(() =>
  Array.from(document.images).every((img) => img.complete)
);
await page.waitForTimeout(150);

await page.screenshot({ path: outPath, fullPage: true });
await browser.close();

console.log(outPath);
