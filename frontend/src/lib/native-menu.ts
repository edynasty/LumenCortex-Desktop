import { bridge } from "./bridge";
import type { Locale } from "./i18n/app-copy";

// macOS owns ⌘K, ⌘,, ⌘N and ⌘B through the native menu bar (menu.go). While it is installed the
// webview's own key handlers for those keys stand down, so a command fires exactly once; in a
// browser, or when the bridge reports no native menu, they keep working.
let installed = false;

export function nativeMenuInstalled(): boolean {
  return installed;
}

/** Installs the menu bar in the app language; safe to call again when the language changes. */
export async function installNativeMenu(locale: Locale): Promise<void> {
  try {
    installed = await bridge.setMenuLocale(locale);
  } catch {
    installed = false;
  }
}

/** The key a native menu command owns, so handlers can stand down for it. */
export function menuOwnsKey(key: string): boolean {
  return installed && (key === "k" || key === "," || key === "n" || key === "b");
}
