import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
  activeCarouselBrandSlug,
  carouselRootCss,
  deriveCarouselTokens,
  listCarouselBrands,
  normalizeBrandRef,
  resolveCarouselBrandCss,
  setActiveCarouselBrand,
} from '../src/carousel-brand.js';

const ASSETS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../assets/carousel',
);

const tempDirs: string[] = [];

function makeHome(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'od-brand-'));
  tempDirs.push(d);
  process.env.MAQUINA_CARROSSEL_HOME = d;
  return d;
}

async function makeBrand(
  home: string,
  slug: string,
  brand: Record<string, unknown>,
  skin?: string,
): Promise<string> {
  const dir = path.join(home, 'marcas', slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'brand.json'), JSON.stringify(brand, null, 2), 'utf8');
  if (skin != null) await writeFile(path.join(dir, 'skin.css'), skin, 'utf8');
  return dir;
}

const ACME = {
  $schema: 'brandpack/v1',
  slug: 'acme',
  nome: 'ACME',
  handle: '@acme',
  visual_tokens: {
    cores: { primaria: '#0057FF' },
    fontes: { headline: 'Inter', body: 'Inter' },
  },
  quality: { status: 'pronto' },
};

afterEach(() => {
  delete process.env.MAQUINA_CARROSSEL_HOME;
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('carousel brand tokens', () => {
  it('reproduces the proven Root skin byte-for-byte from the bundled pack', async () => {
    makeHome(); // vazio: sem marcas do usuário, resolve o pack empacotado
    const composed = await resolveCarouselBrandCss('root');
    const baked = await readFile(path.join(ASSETS, 'base-skin.root.css'), 'utf8');
    // O arquivo provado em paridade de pixel com a V02 é a âncora: compor
    // base.css + tokens(brand.json) + skin.css TEM que reconstruí-lo.
    expect(composed.trimEnd()).toBe(baked.trimEnd());
  });

  it('derives the same palette as the V02 culori pipeline for the Root pack', async () => {
    const brand = JSON.parse(
      await readFile(path.join(ASSETS, 'brands/root/brand.json'), 'utf8'),
    );
    const t = deriveCarouselTokens(brand);
    expect(t.P).toBe('#9bdb1f');
    expect(t.PL).toBe('#c4ff2e');
    expect(t.PD).toBe('#1c3010');
    // Derivado (não vem do brand.json): mix oklab de #FF1F6B com preto.
    expect(t.ALERT_D).toBe('#980e3d');
    expect(t.F_HEAD).toBe('JetBrains Mono');
  });

  it('derives light/dark ramps from a single primary color', () => {
    const t = deriveCarouselTokens(ACME);
    expect(t.P).toBe('#0057ff');
    expect(t.PL).toMatch(/^#[0-9a-f]{6}$/);
    expect(t.PD).toMatch(/^#[0-9a-f]{6}$/);
    expect(t.PL).not.toBe(t.P);
    expect(t.PD).not.toBe(t.P);
    expect(t.warm).toBe(false);
    const css = carouselRootCss(ACME);
    expect(css).toContain('--P:#0057ff');
    expect(css).toContain("--F-HEAD: 'Inter'");
  });
});

describe('scrim default por luminância', () => {
  it('marca clara nasce sem véu; marca escura mantém o gradiente preto', () => {
    const clara = { visual_tokens: { cores: { primaria: '#7c3aed', bg: '#ffffff', texto: '#1a1a1a' } } };
    const escura = { visual_tokens: { cores: { primaria: '#7c3aed', bg: '#0a0a0a', texto: '#f0f0f0' } } };
    expect(carouselRootCss(clara)).toContain('--SCRIM:none');
    expect(carouselRootCss(escura)).toContain('--SCRIM:linear-gradient');
    // Declaração explícita vence o default de luminância.
    const claraForcada = {
      visual_tokens: { cores: { bg: '#ffffff' } },
      render_tokens: { SCRIM: 'rgba(0,0,0,.5)' },
    };
    expect(carouselRootCss(claraForcada)).toContain('--SCRIM:rgba(0,0,0,.5)');
  });
});

describe('carousel brand resolution', () => {
  it('resolves a user brand by slug and by the absolute path the skill writes', async () => {
    const home = makeHome();
    const dir = await makeBrand(home, 'acme', ACME, '/* acme skin */\n.tag{color:#0057FF}\n');
    const bySlug = await resolveCarouselBrandCss('acme');
    expect(bySlug).toContain('--P:#0057ff');
    expect(bySlug).toContain('/* acme skin */');
    const byPath = await resolveCarouselBrandCss(path.join(dir, 'brand.json'));
    expect(byPath).toBe(bySlug);
    expect(normalizeBrandRef(path.join(dir, 'brand.json'))).toBe('acme');
  });

  it('refuses refs outside the brands root and falls back to the Root skin', async () => {
    makeHome();
    const baked = await readFile(path.join(ASSETS, 'base-skin.root.css'), 'utf8');
    for (const hostile of ['/etc', '/etc/passwd', '../../root', 'não válido']) {
      const css = await resolveCarouselBrandCss(hostile);
      expect(css.trimEnd()).toBe(baked.trimEnd());
      expect(normalizeBrandRef(hostile)).toBeNull();
    }
  });

  it('falls back to the active brand when the deck has no ref', async () => {
    const home = makeHome();
    await makeBrand(home, 'acme', ACME, '/* acme skin */');
    await setActiveCarouselBrand('acme');
    const css = await resolveCarouselBrandCss(null);
    expect(css).toContain('/* acme skin */');
  });

  it('lists user brands merged with the bundled Root pack, active first', async () => {
    const home = makeHome();
    await makeBrand(home, 'acme', ACME);
    await setActiveCarouselBrand('acme');
    const brands = await listCarouselBrands();
    expect(brands[0]).toMatchObject({ slug: 'acme', nome: 'ACME', ativa: true, bundled: false });
    expect(brands.some((b) => b.slug === 'root' && b.bundled)).toBe(true);
    expect(await activeCarouselBrandSlug()).toBe('acme');
  });

  it('setActiveCarouselBrand preserves unrelated config.json keys', async () => {
    const home = makeHome();
    await mkdir(home, { recursive: true });
    await writeFile(
      path.join(home, 'config.json'),
      JSON.stringify({ marca_ativa: 'root', outra_config: 42 }),
      'utf8',
    );
    await makeBrand(home, 'acme', ACME);
    await setActiveCarouselBrand('acme');
    const config = JSON.parse(await readFile(path.join(home, 'config.json'), 'utf8'));
    expect(config).toEqual({ marca_ativa: 'acme', outra_config: 42 });
  });
});
