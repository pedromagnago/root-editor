import type { AppTheme } from '../types';

const ACCENT_VARS = [
  '--accent',
  '--accent-strong',
  '--accent-soft',
  '--accent-tint',
  '--accent-hover',
  '--accent-contrast',
] as const;

export const DEFAULT_ACCENT_COLOR = '#9bdb1f';
export const ACCENT_SWATCHES = [
  DEFAULT_ACCENT_COLOR,
  '#2563eb',
  '#7c3aed',
  '#059669',
  '#dc2626',
  '#d97706',
  '#0891b2',
  '#db2777',
] as const;

export function normalizeAccentColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function resolveAccentColor(value: unknown): string {
  return normalizeAccentColor(value) ?? DEFAULT_ACCENT_COLOR;
}

function linearChannel(hex: string, offset: number): number {
  const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  return 0.2126 * linearChannel(hex, 1) + 0.7152 * linearChannel(hex, 3) + 0.0722 * linearChannel(hex, 5);
}

/**
 * Luminance crossover where dark ink (#070A08, L≈0.0028) and white yield
 * the same WCAG contrast ratio: sqrt(1.05 · (L_ink + 0.05)) − 0.05 ≈ 0.1855.
 * Above it dark ink always contrasts more; below it white does. Picking the
 * winner keeps every ACCENT_SWATCHES entry at AA ≥ 4.5:1 — a mid threshold
 * (e.g. 0.45) would leave #059669/#d97706/#0891b2 below 4.5:1 with white.
 */
const ACCENT_CONTRAST_LUMINANCE_THRESHOLD = 0.1855;

/**
 * Ink color for text/icons rendered on top of the accent. Light accents
 * (e.g. lime) need dark ink; dark accents (e.g. blue/violet) need white —
 * a fixed choice would fail WCAG AA on the other half of ACCENT_SWATCHES.
 * Keep the threshold and both hexes in sync with the pre-hydration script
 * in app/layout.tsx.
 */
export function accentContrastColor(accentColor: string): string {
  return relativeLuminance(accentColor) > ACCENT_CONTRAST_LUMINANCE_THRESHOLD ? '#070A08' : '#ffffff';
}

function accentVars(accentColor: string): Record<(typeof ACCENT_VARS)[number], string> {
  return {
    '--accent': accentColor,
    // Keep these mix ratios in sync with the pre-hydration script in app/layout.tsx.
    '--accent-strong': `color-mix(in srgb, ${accentColor} 86%, var(--text-strong))`,
    '--accent-soft': `color-mix(in srgb, ${accentColor} 22%, var(--bg-panel))`,
    '--accent-tint': `color-mix(in srgb, ${accentColor} 12%, var(--bg-panel))`,
    '--accent-hover': `color-mix(in srgb, ${accentColor} 90%, var(--text-strong))`,
    '--accent-contrast': accentContrastColor(accentColor),
  };
}

export function applyAppearanceToDocument({
  theme,
  accentColor,
}: {
  theme?: AppTheme;
  accentColor?: string;
}): void {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }

  const normalized = resolveAccentColor(accentColor);
  const vars = accentVars(normalized);
  for (const name of ACCENT_VARS) {
    root.style.setProperty(name, vars[name]);
  }
}
