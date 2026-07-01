// carousel-import: slides.json (contrato V02/V03 da máquina de carrossel) →
// deck HTML com elementos `.slide` que o deck renderer captura (um PNG por
// slide). Markup portado do render.mjs provado da V02; o CSS (layout + fontes
// base64 + skin da marca Root) vem de assets/carousel/base-skin.root.css,
// extraído verbatim do render.html da V02 para manter paridade de pixel.
// Fase 2 separa CSS-base (template) da skin por-marca; por ora ficam juntos.
//
// Diferença deliberada vs render.mjs: todo texto do contrato é escapado; só
// <strong>/<em> passam (o contrato permite ênfase inline, nada além disso).

import { readFile } from 'node:fs/promises';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_SKIN_CSS_PATH = nodePath.resolve(
  nodePath.dirname(fileURLToPath(import.meta.url)),
  '../assets/carousel/base-skin.root.css',
);

const SLIDE_BGS = new Set(['light', 'dark', 'gradient', 'alert']);
const SLIDE_TIPOS = new Set(['capa', 'conteudo', 'fechamento']);
const FRAMEWORKS = new Set([
  'armadilha',
  'raio-x',
  'dados-decidem',
  'caso-pratica',
  'nicho-attack',
]);
const COMPONENT_TIPOS = new Set([
  'data-pill',
  'strike-pill',
  'insight-box',
  'feature-list',
  'numbered-steps',
  'table',
  'cta-button',
]);

export interface CarouselComponent {
  tipo: string;
  variante?: string;
  number?: string;
  label?: string;
  before?: string;
  after?: string;
  icon?: string;
  texto?: string;
  fonte?: string;
  itens?: Array<{ icon?: string; titulo?: string; texto?: string }>;
  passos?: Array<{ numero?: string; titulo?: string; texto?: string }>;
  colunas?: string[];
  linhas?: string[][];
}

export interface CarouselSlide {
  ordem: number;
  bg: string;
  papel: string;
  tipo?: string;
  tag?: string;
  headline?: string;
  blocos?: string[];
  componentes?: CarouselComponent[];
  source?: string;
  cta?: { instrucao?: string; palavra?: string; beneficio?: string } | null;
  imagem?: { tipo?: string; ref?: string | null };
}

export interface CarouselDeck {
  meta: {
    handle: string;
    marca?: string;
    tipo_badge?: string;
    framework: string;
    tema?: string;
  };
  brand_pack_ref?: string;
  slides: CarouselSlide[];
}

export class CarouselContractError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`slides.json failed contract validation:\n - ${problems.join('\n - ')}`);
    this.name = 'CarouselContractError';
    this.problems = problems;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Valida o contrato slides.json (schema V02 + regras estruturais do
// render.mjs: exatamente 1 capa na ordem 1, 1 fechamento por último, ordem
// sequencial 1..N, cta só no fechamento). Retorna o deck com slides ordenados.
export function parseCarouselSlides(raw: unknown): CarouselDeck {
  const errs: string[] = [];
  if (!isPlainObject(raw)) throw new CarouselContractError(['root must be an object']);

  const meta = raw.meta;
  if (!isPlainObject(meta)) {
    errs.push('meta is required and must be an object');
  } else {
    if (typeof meta.handle !== 'string' || !meta.handle.trim())
      errs.push('meta.handle is required (brand @handle)');
    if (typeof meta.framework !== 'string' || !FRAMEWORKS.has(meta.framework))
      errs.push(
        `meta.framework must be one of: ${[...FRAMEWORKS].join(', ')}`,
      );
  }

  const rawSlides = raw.slides;
  if (!Array.isArray(rawSlides) || rawSlides.length < 4 || rawSlides.length > 10) {
    errs.push('slides must be an array of 4 to 10 slides');
    throw new CarouselContractError(errs);
  }

  for (const [i, s] of rawSlides.entries()) {
    if (!isPlainObject(s)) {
      errs.push(`slide at position ${i + 1} must be an object`);
      continue;
    }
    if (!Number.isInteger(s.ordem) || (s.ordem as number) < 1)
      errs.push(`slide at position ${i + 1}: ordem must be an integer >= 1`);
    if (typeof s.bg !== 'string' || !SLIDE_BGS.has(s.bg))
      errs.push(`slide ${s.ordem ?? i + 1}: bg must be one of light|dark|gradient|alert`);
    if (typeof s.papel !== 'string' || !s.papel.trim())
      errs.push(`slide ${s.ordem ?? i + 1}: papel is required`);
    if (s.tipo != null && (typeof s.tipo !== 'string' || !SLIDE_TIPOS.has(s.tipo)))
      errs.push(`slide ${s.ordem ?? i + 1}: tipo must be capa|conteudo|fechamento`);
    if (s.blocos != null) {
      if (!Array.isArray(s.blocos) || s.blocos.length > 2 || s.blocos.some((b) => typeof b !== 'string'))
        errs.push(`slide ${s.ordem ?? i + 1}: blocos must be an array of at most 2 strings`);
    }
    if (s.componentes != null) {
      if (!Array.isArray(s.componentes)) {
        errs.push(`slide ${s.ordem ?? i + 1}: componentes must be an array`);
      } else {
        for (const c of s.componentes) {
          if (!isPlainObject(c) || typeof c.tipo !== 'string' || !COMPONENT_TIPOS.has(c.tipo))
            errs.push(
              `slide ${s.ordem ?? i + 1}: componente.tipo must be one of: ${[...COMPONENT_TIPOS].join(', ')}`,
            );
        }
      }
    }
    if (s.imagem != null) {
      if (
        !isPlainObject(s.imagem) ||
        (s.imagem.tipo != null && s.imagem.tipo !== 'none' && s.imagem.tipo !== 'local')
      )
        errs.push(`slide ${s.ordem ?? i + 1}: imagem.tipo must be none|local`);
    }
  }
  if (errs.length) throw new CarouselContractError(errs);

  const slides = [...(rawSlides as unknown as CarouselSlide[])].sort(
    (a, b) => a.ordem - b.ordem,
  );
  const total = slides.length;
  const tipoOf = (s: CarouselSlide, idx: number) =>
    s.tipo || (idx === 0 ? 'capa' : idx === total - 1 ? 'fechamento' : 'conteudo');

  slides.forEach((s, i) => {
    if (s.ordem !== i + 1)
      errs.push(`ordem must be sequential 1..N without gaps (found ordem=${s.ordem} at position ${i + 1})`);
  });
  const first = slides[0];
  const last = slides[total - 1];
  if (first && tipoOf(first, 0) !== 'capa') errs.push('the first slide must be the capa');
  if (last && tipoOf(last, total - 1) !== 'fechamento')
    errs.push('the last slide must be the fechamento');
  slides.forEach((s, i) => {
    const hasCta = !!s.cta && !!(s.cta.instrucao || s.cta.palavra);
    if (hasCta && i !== total - 1) errs.push(`slide ${s.ordem}: cta is only allowed on the fechamento`);
  });
  if (errs.length) throw new CarouselContractError(errs);

  const deck = raw as unknown as CarouselDeck;
  return { ...deck, slides };
}

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Texto do contrato aceita <strong>/<em> inline; escapa tudo e reabre só eles.
const rich = (s: unknown) =>
  esc(s)
    .replace(/&lt;(\/?)em&gt;/g, '<$1em>')
    .replace(/&lt;(\/?)strong&gt;/g, '<$1strong>');

const pad2 = (n: number) => String(n).padStart(2, '0');

export type CarouselImageResolver = (ref: string) => string | null;

function componentHtml(c: CarouselComponent): string {
  switch (c.tipo) {
    case 'data-pill':
      return `<div class="data-pill ${esc(c.variante || 'neutral')}"><span class="number">${esc(c.number || '')}</span><span class="label">${esc(c.label || '')}</span></div>`;
    case 'strike-pill':
      return `<div class="strike-pill"><span class="before">${esc(c.before || '')}</span><span class="after">${esc(c.after || '')}</span></div>`;
    case 'insight-box':
      return `<div class="insight-box">${c.icon ? `<span class="icon">${esc(c.icon)}</span>` : ''}<p>${rich(c.texto || '')}</p>${c.fonte ? `<span class="source">${esc(c.fonte)}</span>` : ''}</div>`;
    case 'feature-list':
      return `<div class="feature-list">${(c.itens || [])
        .map(
          (it) =>
            `<div class="feature-item"><span class="icon">${esc(it.icon || '✓')}</span><div><strong>${esc(it.titulo || '')}</strong><p>${rich(it.texto || '')}</p></div></div>`,
        )
        .join('')}</div>`;
    case 'numbered-steps':
      return (c.passos || [])
        .map(
          (p, i) =>
            `<div class="step"><span class="step-number">${esc(p.numero || pad2(i + 1))}</span><div><strong>${esc(p.titulo || '')}</strong><p>${rich(p.texto || '')}</p></div></div>`,
        )
        .join('');
    case 'table': {
      const head = (c.colunas || []).map((h) => `<th>${esc(h)}</th>`).join('');
      const rows = (c.linhas || [])
        .map((r) => `<tr>${r.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`)
        .join('');
      return `<table class="data-table">${head ? `<tr>${head}</tr>` : ''}${rows}</table>`;
    }
    case 'cta-button':
      return `<div class="cta-button"><span>${esc(c.label || 'SAIBA MAIS')}</span></div>`;
    default:
      return '';
  }
}

function slideHtml(
  s: CarouselSlide,
  i: number,
  deck: CarouselDeck,
  resolveImage: CarouselImageResolver,
): string {
  const total = deck.slides.length;
  const meta = deck.meta;
  const isLast = i === total - 1;
  const isCapa = (s.tipo || (i === 0 ? 'capa' : '')) === 'capa' || i === 0;
  const fillPct = isLast ? 100 : Math.round(((i + 1) / total) * 100);
  const bar = `<div class="brand-bar"><span>${esc(meta.handle)}</span><span class="counter">${i + 1}/${total}</span></div>`;
  const progress = `<div class="progress"><div class="fill" style="width:${fillPct}%"></div></div>`;
  const swipe = isLast ? '' : `<div class="swipe">›</div>`;
  const imgSrc =
    s.imagem && s.imagem.tipo === 'local' && s.imagem.ref ? resolveImage(s.imagem.ref) : null;

  if (isCapa) {
    const badge = meta.tipo_badge ? `<div class="badge">${esc(meta.tipo_badge)}</div>` : '';
    return (
      `<div class="slide capa ${esc(s.bg)}" id="slide-${i + 1}">` +
      `<div class="skin-layer"></div>` +
      (imgSrc
        ? `<div class="capa-bg" style="background-image:url('${imgSrc}')"></div><div class="capa-grad"></div>`
        : '') +
      `${bar}${swipe}` +
      `<div class="content">${badge}<div class="capa-headline">${rich(s.headline || '')}</div></div>` +
      `${progress}</div>`
    );
  }

  const tag = s.tag
    ? `<div class="tag${/nicho/i.test(s.papel || '') ? ' niche' : ''}">${esc(s.tag)}</div>`
    : '';
  const head = s.headline ? `<div class="h1">${rich(s.headline)}</div>` : '';
  const blocos = (s.blocos || []).map((b) => `<div class="body">${rich(b)}</div>`).join('');
  const comps = (s.componentes || []).map(componentHtml).join('');
  const source = s.source ? `<div class="source-badge">${esc(s.source)}</div>` : '';
  const imgBox = imgSrc ? `<div class="img-box"><img src="${imgSrc}"></div>` : '';
  let cta = '';
  if (isLast && s.cta && (s.cta.instrucao || s.cta.palavra)) {
    const label = [s.cta.instrucao, s.cta.palavra ? `"${s.cta.palavra}"` : '', '→']
      .filter(Boolean)
      .join(' ');
    cta = `<div class="cta-button"><span>${esc(label)}</span></div>${s.cta.beneficio ? `<div class="body">${rich(s.cta.beneficio)}</div>` : ''}`;
  }
  return (
    `<div class="slide ${esc(s.bg)}${imgBox ? ' has-img' : ''}" id="slide-${i + 1}">` +
    `<div class="skin-layer"></div>` +
    `<div class="scrim"></div>` +
    `${bar}${swipe}` +
    `<div class="content">${imgBox}${tag}${comps}${head}${blocos}${cta}${source}</div>` +
    `${progress}</div>`
  );
}

let baseSkinCssCache: string | null = null;
export async function loadBaseSkinCss(): Promise<string> {
  if (baseSkinCssCache == null) {
    baseSkinCssCache = await readFile(BASE_SKIN_CSS_PATH, 'utf8');
  }
  return baseSkinCssCache;
}

export async function buildCarouselDeckHtml(
  deck: CarouselDeck,
  options: { resolveImage?: CarouselImageResolver; css?: string } = {},
): Promise<string> {
  const css = options.css ?? (await loadBaseSkinCss());
  const resolveImage = options.resolveImage ?? (() => null);
  const body = deck.slides.map((s, i) => slideHtml(s, i, deck, resolveImage)).join('\n');
  const title = `${deck.meta.marca ?? 'carrossel'} — ${deck.meta.tema ?? ''}`.trim();
  return (
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${esc(title)}</title>` +
    `<style>${css}</style></head>` +
    `<body><div style="display:flex;flex-direction:column;gap:24px;align-items:center;padding:24px;">${body}</div></body></html>`
  );
}
