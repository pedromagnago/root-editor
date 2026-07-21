import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { BrowserWindow } from "electron";

// Loads a full HTML document into a window via a temp file + file:// URL instead
// of `data:text/html,<encoded doc>`. A deck/artifact with embedded base64 fonts
// or images produces a data: URL past Chromium's ~2MB URL cap, which fails the
// whole navigation with ERR_INVALID_URL (-300) and drops the entire export. A
// file:// load has no such length limit; the rendered result is identical, and
// the already-injected `<base href>` still resolves any external assets.
export async function loadHtmlDocumentIntoWindow(window: BrowserWindow, doc: string): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), "od-render-"));
  const file = path.join(dir, "index.html");
  await writeFile(file, doc, "utf8");
  try {
    // Resolves on did-finish-load, after the document + subresources are parsed
    // into the renderer, so the temp file is safe to remove right after.
    await window.loadURL(pathToFileURL(file).href);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
