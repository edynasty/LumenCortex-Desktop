#!/usr/bin/env node
/*
 * Generates the LumenCortex macOS application icon from the approved A1 masters:
 *
 *   build/appicon.svg        glass master  -> build/appicon.png (1024) and iconset sizes >= 64
 *   build/appicon-small.svg  small master  -> iconset sizes <= 32 (Finder lists, menus)
 *
 * The Dock draws the 64-256 px members, so those are the glass mark the About page and the
 * welcome screen show; the flat silhouette is kept only where the glass detail turns to mush.
 *
 * Renders each member with the same Chromium (Playwright) the visual tests use, because a
 * browser is the only renderer here that composites the SVG masters pixel-exactly (gradients,
 * squircle, embedded PNG). The per-size PNGs go into a temporary .iconset and `iconutil`
 * packs it into build/darwin/iconfile.icns, which scripts/build-macos.sh installs into the
 * app bundle (Wails only ships a nearest-neighbour resample of appicon.png otherwise).
 *
 * Usage: node scripts/generate-app-icon.mjs   (from the repository root)
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(new URL("..", import.meta.url).pathname);

const requireFromFrontend = createRequire(path.join(root, "frontend", "package.json"));
const { chromium } = requireFromFrontend("playwright");

const GLASS_PNG = path.join(root, "frontend/src/components/brand/a1-glass.png");

/** iconset members with the pixel size and the master that renders them. */
const ICONSET = [
  ["icon_16x16.png", 16, "small"],
  ["icon_16x16@2x.png", 32, "small"],
  ["icon_32x32.png", 32, "small"],
  ["icon_32x32@2x.png", 64, "glass"],
  ["icon_128x128.png", 128, "glass"],
  ["icon_128x128@2x.png", 256, "glass"],
  ["icon_256x256.png", 256, "glass"],
  ["icon_256x256@2x.png", 512, "glass"],
  ["icon_512x512.png", 512, "glass"],
  ["icon_512x512@2x.png", 1024, "glass"],
];

/** One master at one pixel size, as a self-contained page. */
function svgPage(master, size) {
  const file = master === "small" ? "appicon-small.svg" : "appicon.svg";
  let svg = readFileSync(path.join(root, "build", file), "utf8");
  // The embedded image must not depend on the SVG's on-disk location.
  const dataUri = `data:image/png;base64,${readFileSync(GLASS_PNG).toString("base64")}`;
  svg = svg.replace(/href="[^"]*a1-glass\.png"/, `href="${dataUri}"`);
  svg = svg.replace(/width="1024" height="1024"/, `width="${size}" height="${size}"`);
  return `<!doctype html><style>html,body{margin:0;padding:0;background:transparent}</style>${svg}`;
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const temp = mkdtempSync(path.join(tmpdir(), "lumencortex-icon-"));
  const iconset = path.join(temp, "AppIcon.iconset");
  mkdirSync(iconset);
  try {
    for (const [name, size, master] of ICONSET) {
      const page = await context.newPage();
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(svgPage(master, size), { waitUntil: "load" });
      await page.locator("svg").first().screenshot({ path: path.join(iconset, name), omitBackground: true });
    }

    // The 1024 master PNG Wails uses for its own icon handling (dev bundle, file dialogs)
    // is the same render as the 1024 iconset member.
    copyFileSync(path.join(iconset, "icon_512x512@2x.png"), path.join(root, "build", "appicon.png"));
    console.log("build/appicon.png  (1024x1024, glass)");

    execFileSync("iconutil", ["-c", "icns", "-o", path.join(root, "build/darwin/iconfile.icns"), iconset]);
    console.log("build/darwin/iconfile.icns");
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
} finally {
  await browser.close();
}
