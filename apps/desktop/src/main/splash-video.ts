// Root splash: static "ROOT" wordmark, no video asset.
//
// The old startup clip (an inlined base64 WebM) is replaced by a small inline
// SVG data URL. It stays embedded in the desktop main bundle for the same
// reason the clip was: the splash window is shown BEFORE the daemon and web
// sidecars boot, so there is no local HTTP server (nor a reliable on-disk asset
// path inside the packaged `.app`) to fetch from yet.
//
// The SVG is TRANSPARENT — it carries only the wordmark and lets the splash
// window's own dark background (`SPLASH_BACKGROUND_COLOR`, set in runtime.ts
// `createPendingHtml` / `createSplashWindow`) show through, mirroring the old
// alpha-video contract. The wordmark uses the system monospace stack so no
// external font is required this early in boot.

/** Splash window + page background (Root canonical dark). */
export const SPLASH_BACKGROUND_COLOR = "#070A08";

/** Root wordmark green. */
export const SPLASH_WORDMARK_COLOR = "#9BDB1F";

// x is nudged half a letter-space right of center because SVG text-anchor
// includes the trailing letter-space in the advance width.
const SPLASH_WORDMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120" viewBox="0 0 480 120"><text x="247" y="60" text-anchor="middle" dominant-baseline="central" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace" font-size="72" font-weight="700" letter-spacing="14" fill="${SPLASH_WORDMARK_COLOR}">ROOT</text></svg>`;

// Name kept from the video era so callers don't change; it is now a static
// image data URL rendered by the splash page's <img>.
export const SPLASH_VIDEO_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SPLASH_WORDMARK_SVG)}`;
