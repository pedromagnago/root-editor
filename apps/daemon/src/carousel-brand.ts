// carousel-brand: resolve a skin de marca do carrossel (brand pack V02,
// schema brandpack/v1) e componha o CSS final do deck:
//
//   base.css (template + fontes base64)  +  :root{tokens}  +  skin.css da marca
//
// Os brand packs moram em ~/.maquina-carrossel/marcas/<slug>/ (a MESMA
// convenção que a skill carrossel-root lê/escreve no intake) e um pack da
// Root vem empacotado em assets/carousel/brands/root como default de
// fábrica. A derivação de tokens porta lib/tokens.mjs da V02 (culori →
// oklab) sem dependência nova; o teste-âncora garante que compor o pack da
// Root reproduz byte a byte o base-skin.root.css provado em paridade de
// pixel com a V02.
//
// Segurança: `brand_pack_ref` vem de um slides.json fornecido pelo usuário —
// só é honrado quando resolve para DENTRO da raiz de marcas (ou do bundle);
// qualquer outra coisa cai no fallback, nunca em leitura de path arbitrário.

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS_DIR = nodePath.resolve(
  nodePath.dirname(fileURLToPath(import.meta.url)),
  '../assets/carousel',
);
const BASE_CSS_PATH = nodePath.join(ASSETS_DIR, 'base.css');
const BAKED_SKIN_PATH = nodePath.join(ASSETS_DIR, 'base-skin.root.css');
const BUNDLED_BRANDS_DIR = nodePath.join(ASSETS_DIR, 'brands');

const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/i;

export function maquinaCarrosselHome(): string {
  return (
    process.env.MAQUINA_CARROSSEL_HOME || nodePath.join(homedir(), '.maquina-carrossel')
  );
}

export function carouselBrandsDir(): string {
  return nodePath.join(maquinaCarrosselHome(), 'marcas');
}

// ---- Derivação de tokens (porta de plugins/maquina-carrossel/render/lib/tokens.mjs) ----

const DEFAULTS = {
  P: '#2D6BFF',
  ALERT: '#FF6B35',
  OK: '#00C853',
  DT: '#1A2332',
  LT: '#F5F7FA',
  F_HEAD: 'Space Grotesk',
  F_BODY: 'DM Sans',
};

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(value: unknown): Rgb | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m || !m[1]) return null;
  let hex: string = m[1];
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
  };
}

function formatHex({ r, g, b }: Rgb): string {
  const ch = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

// sRGB ↔ Oklab (Björn Ottosson) — as mesmas matrizes que o culori usa; a
// mistura perceptual em oklab reproduz o mix() da V02.
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function rgbToOklab({ r, g, b }: Rgb): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]: [number, number, number]): Rgb {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  };
}

function mix(aHex: string, bHex: string, t: number): string {
  const a = rgbToOklab(parseHex(aHex)!);
  const b = rgbToOklab(parseHex(bHex)!);
  return formatHex(
    oklabToRgb([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ]),
  );
}

function hueOf(rgb: Rgb): number | undefined {
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return undefined;
  const d = max - min;
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return h * 60;
}

function safeHex(value: unknown, fallback: string): string {
  const parsed = parseHex(value);
  return parsed ? formatHex(parsed) : fallback;
}

export interface CarouselBrandPack {
  slug?: string;
  nome?: string;
  handle?: string;
  skin?: string;
  render_tokens?: Record<string, string>;
  visual_tokens?: {
    cores?: Record<string, string>;
    fontes?: Record<string, string>;
  };
  quality?: { status?: string };
}

function readBrand(brand: CarouselBrandPack) {
  const rt = brand?.render_tokens || {};
  const vt = brand?.visual_tokens || {};
  const cores = vt.cores || {};
  const fontes = vt.fontes || {};
  return {
    P: rt.P || cores.primaria || (cores as any).primary || DEFAULTS.P,
    ALERT: rt.ALERT || cores.acento || (cores as any).accent || DEFAULTS.ALERT,
    OK: rt.OK || cores.sucesso || (cores as any).success || DEFAULTS.OK,
    F_HEAD: rt.F_HEAD || fontes.headline || (fontes as any).titulo || DEFAULTS.F_HEAD,
    F_BODY: rt.F_BODY || fontes.body || (fontes as any).corpo || DEFAULTS.F_BODY,
    PL: rt.PL,
    PD: rt.PD,
    LB: rt.LB,
    DB: rt.DB,
    LR: rt.LR,
  };
}

export function deriveCarouselTokens(brand: CarouselBrandPack = {}) {
  const b = readBrand(brand);
  const P = safeHex(b.P, DEFAULTS.P);
  const ALERT = safeHex(b.ALERT, DEFAULTS.ALERT);
  const OK = safeHex(b.OK, DEFAULTS.OK);

  const hue = hueOf(parseHex(P)!) ?? 220;
  const warm = hue < 90 || hue > 330;

  const PL = safeHex(b.PL, mix(P, '#ffffff', 0.18));
  const PD = safeHex(b.PD, mix(P, '#000000', 0.28));
  const LB = safeHex(b.LB, warm ? '#F7F5F2' : '#F4F5F7');
  const DB = safeHex(b.DB, warm ? '#16120D' : '#0E1320');
  const LR = b.LR || 'rgba(26,35,50,0.10)';
  const ALERT_D = mix(ALERT, '#000000', 0.32);

  return {
    P,
    PL,
    PD,
    LB,
    DB,
    LR,
    ALERT,
    ALERT_D,
    OK,
    DT: DEFAULTS.DT,
    LT: DEFAULTS.LT,
    F_HEAD: b.F_HEAD,
    F_BODY: b.F_BODY,
    warm,
  };
}

// Bloco :root com as vars que o base.css consome — mesmo formato da V02
// (o base-skin.root.css provado foi gerado por este template).
export function carouselRootCss(brand: CarouselBrandPack = {}): string {
  const t = deriveCarouselTokens(brand);
  return `:root{
  --P:${t.P}; --PL:${t.PL}; --PD:${t.PD};
  --LB:${t.LB}; --LR:${t.LR}; --DB:${t.DB};
  --DT:${t.DT}; --LT:${t.LT};
  --ALERT:${t.ALERT}; --ALERT-D:${t.ALERT_D}; --OK:${t.OK};
  --G: linear-gradient(165deg, ${t.PD} 0%, ${t.P} 50%, ${t.PL} 100%);
  --G-ALERT: linear-gradient(165deg, ${t.ALERT_D} 0%, ${t.ALERT} 100%);
  --F-HEAD: '${t.F_HEAD}', 'Space Grotesk', system-ui, sans-serif;
  --F-BODY: '${t.F_BODY}', 'DM Sans', system-ui, sans-serif;
}`;
}

// ---- Resolução de brand pack ----

export interface CarouselBrandSummary {
  slug: string;
  nome: string;
  handle: string;
  pronta: boolean;
  ativa: boolean;
  bundled: boolean;
}

async function readBrandJson(dir: string): Promise<CarouselBrandPack | null> {
  try {
    const raw = await readFile(nodePath.join(dir, 'brand.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as CarouselBrandPack)
      : null;
  } catch {
    return null;
  }
}

export async function activeCarouselBrandSlug(): Promise<string | null> {
  try {
    const raw = await readFile(
      nodePath.join(maquinaCarrosselHome(), 'config.json'),
      'utf8',
    );
    const parsed = JSON.parse(raw);
    const slug = parsed?.marca_ativa;
    return typeof slug === 'string' && SLUG_RE.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

export async function setActiveCarouselBrand(slug: string): Promise<void> {
  if (!SLUG_RE.test(slug)) throw new Error(`invalid brand slug: ${slug}`);
  const home = maquinaCarrosselHome();
  await mkdir(home, { recursive: true });
  let config: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(await readFile(nodePath.join(home, 'config.json'), 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) config = parsed;
  } catch {
    // ausente/corrompido: recria só com o campo que gerenciamos
  }
  config.marca_ativa = slug;
  await writeFile(
    nodePath.join(home, 'config.json'),
    JSON.stringify(config, null, 2) + '\n',
    'utf8',
  );
}

// Lista marcas do usuário (marcas/) + bundled (root), dedup por slug — a do
// usuário ganha (ela pode ter evoluído a skin da Root local).
export async function listCarouselBrands(): Promise<CarouselBrandSummary[]> {
  const ativa = (await activeCarouselBrandSlug()) ?? 'root';
  const out = new Map<string, CarouselBrandSummary>();
  const scan = async (rootDir: string, bundled: boolean) => {
    let entries: string[];
    try {
      entries = (await readdir(rootDir, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      return;
    }
    for (const slug of entries) {
      if (!SLUG_RE.test(slug) || out.has(slug)) continue;
      const brand = await readBrandJson(nodePath.join(rootDir, slug));
      if (!brand) continue;
      out.set(slug, {
        slug,
        nome: typeof brand.nome === 'string' && brand.nome.trim() ? brand.nome : slug,
        handle: typeof brand.handle === 'string' ? brand.handle : '',
        pronta: brand.quality?.status === 'pronto',
        ativa: slug === ativa,
        bundled,
      });
    }
  };
  await scan(carouselBrandsDir(), false);
  await scan(BUNDLED_BRANDS_DIR, true);
  return [...out.values()].sort((a, b) =>
    a.ativa !== b.ativa ? (a.ativa ? -1 : 1) : a.slug.localeCompare(b.slug),
  );
}

// `ref` (slug ou caminho absoluto de brand.json/pasta, como a skill grava) →
// diretório de brand pack validado DENTRO da raiz de marcas ou do bundle.
// null quando não resolve — o chamador decide o fallback.
function resolveBrandDir(ref: string): string | null {
  const tryRoots = (candidate: string): string | null => {
    for (const root of [carouselBrandsDir(), BUNDLED_BRANDS_DIR]) {
      let rootReal: string;
      try {
        rootReal = realpathSync(root);
      } catch {
        continue;
      }
      let real: string;
      try {
        real = realpathSync(candidate);
      } catch {
        continue;
      }
      if (real !== rootReal && real.startsWith(rootReal + nodePath.sep)) return real;
    }
    return null;
  };
  const trimmed = ref.trim();
  if (!trimmed) return null;
  if (SLUG_RE.test(trimmed)) {
    return (
      tryRoots(nodePath.join(carouselBrandsDir(), trimmed)) ??
      tryRoots(nodePath.join(BUNDLED_BRANDS_DIR, trimmed))
    );
  }
  if (nodePath.isAbsolute(trimmed)) {
    const dir = trimmed.endsWith('brand.json') ? nodePath.dirname(trimmed) : trimmed;
    return tryRoots(dir);
  }
  return null;
}

// Slug canônico de um ref (para carimbar no slides.json de forma portável
// entre máquinas — nunca guardamos caminho absoluto no working copy).
export function normalizeBrandRef(ref: unknown): string | null {
  if (typeof ref !== 'string') return null;
  const dir = resolveBrandDir(ref);
  return dir ? nodePath.basename(dir) : null;
}

async function composeBrandCss(brandDir: string): Promise<string | null> {
  const brand = await readBrandJson(brandDir);
  if (!brand) return null;
  const skinFile =
    typeof brand.skin === 'string' && brand.skin && !brand.skin.includes('/')
      ? brand.skin
      : 'skin.css';
  let skin = '';
  try {
    skin = await readFile(nodePath.join(brandDir, skinFile), 'utf8');
  } catch {
    // pack sem skin: só tokens — válido (a skin é refinamento visual)
  }
  const base = await readFile(BASE_CSS_PATH, 'utf8');
  return `${base}${carouselRootCss(brand)}\n/* skin da marca */\n${skin}`;
}

let bakedSkinCache: string | null = null;

// CSS final do deck para um brand_pack_ref (ou ausência dele). Ordem:
// ref do deck → marca ativa do config.json → skin Root provada (baked).
// Falha de qualquer candidato degrada para o próximo — render nunca quebra
// por brand pack ruim.
export async function resolveCarouselBrandCss(ref?: string | null): Promise<string> {
  const candidates: string[] = [];
  if (typeof ref === 'string' && ref.trim()) candidates.push(ref);
  const active = await activeCarouselBrandSlug();
  if (active) candidates.push(active);
  candidates.push('root');
  for (const candidate of candidates) {
    const dir = resolveBrandDir(candidate);
    if (!dir) continue;
    const css = await composeBrandCss(dir);
    if (css) return css;
  }
  if (bakedSkinCache == null) bakedSkinCache = await readFile(BAKED_SKIN_PATH, 'utf8');
  return bakedSkinCache;
}
