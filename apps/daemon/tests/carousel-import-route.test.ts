import type http from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  resetDesktopAuthForTests,
  setDesktopAuthSecret,
  startServer,
} from '../src/server.js';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function validDeck(): Record<string, unknown> {
  return {
    meta: { handle: '@root', framework: 'raio-x', tema: 'Peça de teste', tipo_badge: 'ALERTA' },
    slides: [
      { ordem: 1, bg: 'dark', papel: 'hook', tipo: 'capa', headline: 'Capa <em>viva</em>' },
      {
        ordem: 2,
        bg: 'dark',
        papel: 'prova',
        tag: 'OS DADOS',
        headline: 'Headline 2',
        blocos: ['bloco <strong>forte</strong>'],
        imagem: { tipo: 'local', ref: 'img.png' },
      },
      {
        ordem: 3,
        bg: 'alert',
        papel: 'virada',
        headline: 'Injeção <script>alert(1)</script>',
        componentes: [{ tipo: 'data-pill', variante: 'danger', number: '85%', label: 'x' }],
      },
      {
        ordem: 4,
        bg: 'dark',
        papel: 'cta',
        tipo: 'fechamento',
        headline: 'Fim',
        cta: { instrucao: 'Comente', palavra: 'ROOT', beneficio: 'te mando o link' },
      },
    ],
  };
}

describe('POST /api/import/carousel', () => {
  let server: http.Server;
  let baseUrl: string;
  const tempDirs: string[] = [];

  beforeAll(async () => {
    const started = (await startServer({ port: 0, returnServer: true })) as {
      url: string;
      server: http.Server;
    };
    baseUrl = started.url;
    server = started.server;
  });

  afterEach(() => {
    resetDesktopAuthForTests();
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    return new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function makePieceDir(): string {
    const d = mkdtempSync(path.join(tmpdir(), 'od-carousel-'));
    tempDirs.push(d);
    return d;
  }

  async function importCarousel(body: unknown) {
    return fetch(`${baseUrl}/api/import/carousel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function materializedDir(projectId: string): string {
    return path.join(process.env.OD_DATA_DIR as string, 'projects', projectId);
  }

  it('materializes a deck project from a valid piece folder', async () => {
    const piece = makePieceDir();
    await writeFile(path.join(piece, 'slides.json'), JSON.stringify(validDeck()), 'utf8');
    await writeFile(path.join(piece, 'img.png'), TINY_PNG);

    const resp = await importCarousel({ baseDir: piece });
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as {
      project: { id: string; name: string; metadata: Record<string, unknown> };
      entryFile: string;
      slides: number;
    };
    expect(body.entryFile).toBe('deck.html');
    expect(body.slides).toBe(4);
    expect(body.project.name).toBe('Peça de teste');
    expect(body.project.metadata.importedFrom).toBe('carousel');
    expect(body.project.metadata.entryFile).toBe('deck.html');

    const dir = materializedDir(body.project.id);
    const html = await readFile(path.join(dir, 'deck.html'), 'utf8');
    expect(html.match(/class="slide /g)?.length).toBe(4);
    // Image embedded as base64, copied into the self-contained project.
    expect(html).toContain('data:image/png;base64,');
    const copiedImage = await readFile(path.join(dir, 'assets', 'img.png'));
    expect(copiedImage.equals(TINY_PNG)).toBe(true);
    const storedDoc = JSON.parse(await readFile(path.join(dir, 'slides.json'), 'utf8'));
    expect(storedDoc.slides[1].imagem.ref).toBe('assets/img.png');
    // Contract emphasis survives; anything else is escaped.
    expect(html).toContain('<em>viva</em>');
    expect(html).toContain('<strong>forte</strong>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    // CTA only renders on the fechamento (quotes are entity-escaped).
    expect(html).toContain('Comente &quot;ROOT&quot; →');

    const manifest = JSON.parse(
      await readFile(path.join(dir, 'deck.html.artifact.json'), 'utf8'),
    );
    expect(manifest.kind).toBe('deck');
    expect(manifest.renderer).toBe('deck-html');

    // Source contract is kept verbatim for provenance.
    const savedSlides = JSON.parse(await readFile(path.join(dir, 'slides.json'), 'utf8'));
    expect(savedSlides.meta.handle).toBe('@root');
  });

  it('refuses image refs that escape the piece folder', async () => {
    const outside = makePieceDir();
    await writeFile(path.join(outside, 'secret.png'), TINY_PNG);
    const piece = makePieceDir();
    const deck = validDeck();
    (deck.slides as Array<Record<string, unknown>>)[1]!.imagem = {
      tipo: 'local',
      ref: path.join('..', path.basename(outside), 'secret.png'),
    };
    await writeFile(path.join(piece, 'slides.json'), JSON.stringify(deck), 'utf8');

    const resp = await importCarousel({ baseDir: piece });
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { project: { id: string } };
    const html = await readFile(
      path.join(materializedDir(body.project.id), 'deck.html'),
      'utf8',
    );
    expect(html).not.toContain('data:image/png;base64,');
  });

  it('stamps the brand slug and renders with the client brand skin', async () => {
    const home = makePieceDir();
    process.env.MAQUINA_CARROSSEL_HOME = home;
    try {
      const brandDir = path.join(home, 'marcas', 'acme');
      await mkdir(brandDir, { recursive: true });
      await writeFile(
        path.join(brandDir, 'brand.json'),
        JSON.stringify({
          $schema: 'brandpack/v1',
          slug: 'acme',
          nome: 'ACME',
          handle: '@acme',
          visual_tokens: { cores: { primaria: '#0057FF' } },
        }),
        'utf8',
      );
      await writeFile(path.join(brandDir, 'skin.css'), '/* acme skin */', 'utf8');

      const piece = makePieceDir();
      const deck = validDeck();
      // A skill grava caminho absoluto; o working copy tem que virar slug.
      deck.brand_pack_ref = path.join(brandDir, 'brand.json');
      await writeFile(path.join(piece, 'slides.json'), JSON.stringify(deck), 'utf8');

      const resp = await importCarousel({ baseDir: piece });
      expect(resp.status).toBe(200);
      const body = (await resp.json()) as { project: { id: string } };
      const dir = materializedDir(body.project.id);
      const stored = JSON.parse(await readFile(path.join(dir, 'slides.json'), 'utf8'));
      expect(stored.brand_pack_ref).toBe('acme');
      const html = await readFile(path.join(dir, 'deck.html'), 'utf8');
      expect(html).toContain('--P:#0057ff');
      expect(html).toContain('/* acme skin */');
    } finally {
      delete process.env.MAQUINA_CARROSSEL_HOME;
    }
  });

  it('drops a hostile brand ref and renders with the Root skin', async () => {
    // Home isolado e vazio: sem marca ativa, o ref hostil não pode deixar
    // rastro nem resolver — só resta o fallback Root empacotado.
    process.env.MAQUINA_CARROSSEL_HOME = makePieceDir();
    try {
      const piece = makePieceDir();
      const deck = validDeck();
      deck.brand_pack_ref = '/etc/passwd';
      await writeFile(path.join(piece, 'slides.json'), JSON.stringify(deck), 'utf8');

      const resp = await importCarousel({ baseDir: piece });
      expect(resp.status).toBe(200);
      const body = (await resp.json()) as { project: { id: string } };
      const dir = materializedDir(body.project.id);
      const stored = JSON.parse(await readFile(path.join(dir, 'slides.json'), 'utf8'));
      expect(stored.brand_pack_ref).toBeUndefined();
      const html = await readFile(path.join(dir, 'deck.html'), 'utf8');
      expect(html).toContain('--P:#9bdb1f');
    } finally {
      delete process.env.MAQUINA_CARROSSEL_HOME;
    }
  });

  it('rejects a piece that breaks the contract, listing every problem', async () => {
    const piece = makePieceDir();
    const deck = validDeck();
    const slides = deck.slides as Array<Record<string, unknown>>;
    slides[1]!.ordem = 3; // duplicates ordem 3 and leaves a gap at 2
    slides[3]!.tipo = 'conteudo'; // last slide is no longer the fechamento
    await writeFile(path.join(piece, 'slides.json'), JSON.stringify(deck), 'utf8');

    const resp = await importCarousel({ baseDir: piece });
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as {
      error: { message: string; details?: { problems?: string[] } };
    };
    expect(body.error.message).toContain('contract validation');
    expect(body.error.details?.problems?.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects a folder without slides.json', async () => {
    const piece = makePieceDir();
    const resp = await importCarousel({ baseDir: piece });
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error: { message: string } };
    expect(body.error.message).toContain('slides.json not found');
  });

  it('enforces the desktop import token gate when active', async () => {
    setDesktopAuthSecret(randomBytes(32));
    const piece = makePieceDir();
    await writeFile(path.join(piece, 'slides.json'), JSON.stringify(validDeck()), 'utf8');
    const resp = await importCarousel({ baseDir: piece });
    expect(resp.status).toBe(403);
  });

  async function importValidPiece(): Promise<string> {
    const piece = makePieceDir();
    await writeFile(path.join(piece, 'slides.json'), JSON.stringify(validDeck()), 'utf8');
    await writeFile(path.join(piece, 'img.png'), TINY_PNG);
    const resp = await importCarousel({ baseDir: piece });
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { project: { id: string } };
    return body.project.id;
  }

  it('GET /carousel returns the editable working copy', async () => {
    const projectId = await importValidPiece();
    const resp = await fetch(`${baseUrl}/api/projects/${projectId}/carousel`);
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as {
      document: { meta: { handle: string }; slides: Array<Record<string, any>> };
      entryFile: string;
    };
    expect(body.entryFile).toBe('deck.html');
    expect(body.document.meta.handle).toBe('@root');
    expect(body.document.slides).toHaveLength(4);
    expect(body.document.slides[1]!.imagem.ref).toBe('assets/img.png');
  });

  it('GET /carousel is 404 for non-carousel projects', async () => {
    const resp = await fetch(`${baseUrl}/api/projects/does-not-exist/carousel`);
    expect(resp.status).toBe(404);
  });

  it('PUT /carousel persists edits and re-renders the deck', async () => {
    const projectId = await importValidPiece();
    const got = await fetch(`${baseUrl}/api/projects/${projectId}/carousel`);
    const { document } = (await got.json()) as { document: any };
    document.slides[0].headline = 'Headline <em>editada</em> pelo painel';
    document.slides[2].bg = 'gradient';

    const put = await fetch(`${baseUrl}/api/projects/${projectId}/carousel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document }),
    });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { slides: number }).slides).toBe(4);

    const dir = materializedDir(projectId);
    const html = await readFile(path.join(dir, 'deck.html'), 'utf8');
    expect(html).toContain('Headline <em>editada</em> pelo painel');
    expect(html).toContain('class="slide gradient"');
    // The self-contained image still renders after a re-render from edits.
    expect(html).toContain('data:image/png;base64,');
    const stored = JSON.parse(await readFile(path.join(dir, 'slides.json'), 'utf8'));
    expect(stored.slides[0].headline).toBe('Headline <em>editada</em> pelo painel');
  });

  it('PUT /carousel rejects edits that break the contract', async () => {
    const projectId = await importValidPiece();
    const got = await fetch(`${baseUrl}/api/projects/${projectId}/carousel`);
    const { document } = (await got.json()) as { document: any };
    document.slides[3].tipo = 'conteudo'; // no fechamento anymore

    const put = await fetch(`${baseUrl}/api/projects/${projectId}/carousel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document }),
    });
    expect(put.status).toBe(400);
    const body = (await put.json()) as { error: { details?: { problems?: string[] } } };
    expect(body.error.details?.problems?.join(' ')).toContain('fechamento');

    // Contract on disk is untouched after a rejected edit.
    const stored = JSON.parse(
      await readFile(path.join(materializedDir(projectId), 'slides.json'), 'utf8'),
    );
    expect(stored.slides[3].tipo).toBe('fechamento');
  });

  it('POST /api/projects/carousel creates a skill-driven carousel project', async () => {
    const resp = await fetch(`${baseUrl}/api/projects/carousel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'Pronampe 2026 é uma armadilha' }),
    });
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as {
      project: { id: string; name: string; skillId: string; metadata: Record<string, unknown>; pendingPrompt?: string };
      conversationId: string;
    };
    expect(body.project.skillId).toBe('carrossel-root');
    expect(body.project.metadata.carousel).toBe(true);
    expect(body.project.name).toBe('Pronampe 2026 é uma armadilha');
    expect(body.conversationId).toBeTruthy();

    // A subsequent slides.json write is a valid carousel (the project is
    // recognized as a carousel even before its first deck render).
    const got = await fetch(`${baseUrl}/api/projects/${body.project.id}/carousel`);
    // No slides.json yet → GET reports it missing, but the project IS a carousel
    // (not the "not a carousel" 404).
    const err = (await got.json()) as { error: { message: string } };
    expect(err.error.message).toContain('slides.json not found');
  });

  it('POST /api/projects/carousel defaults the name when no theme is given', async () => {
    const resp = await fetch(`${baseUrl}/api/projects/carousel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { project: { name: string; pendingPrompt?: string | null } };
    expect(body.project.name).toBe('Novo carrossel');
  });

  // O componente x-post herda identidade do meta e não inventa engajamento.
  // Regressão contra as duas listas de validação (daemon + schema da skill),
  // que precisam andar juntas: um tipo aceito só num lado produz deck que o
  // agente escreve e o render recusa.
  it('renderiza x-post herdando handle/marca do meta e sem contagem forjada', async () => {
    const piece = makePieceDir();
    const deck = validDeck();
    (deck.meta as Record<string, unknown>).marca = 'ACME';
    (deck.meta as Record<string, unknown>).framework = 'thread';
    (deck.slides as Array<Record<string, unknown>>)[1] = {
      ordem: 2,
      bg: 'dark',
      papel: 'O POST DE ABERTURA',
      componentes: [{ tipo: 'x-post', texto: 'A tese em uma frase.', thread: true }],
    };
    (deck.slides as Array<Record<string, unknown>>)[2] = {
      ordem: 3,
      bg: 'dark',
      papel: 'A CONSEQUÊNCIA',
      componentes: [{ tipo: 'x-post', texto: 'O fechamento.', acoes: false }],
    };
    await writeFile(path.join(piece, 'slides.json'), JSON.stringify(deck), 'utf8');

    const resp = await importCarousel({ baseDir: piece });
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { project: { id: string } };
    const html = await readFile(path.join(materializedDir(body.project.id), 'deck.html'), 'utf8');
    const rendered = html.split('</style>').pop() ?? '';

    expect(rendered.match(/class="x-post/g)).toHaveLength(2);
    // Identidade vem do meta — o componente não repete handle nem nome.
    expect(rendered).toContain('class="x-name">ACME<');
    expect(rendered).toContain('class="x-handle">@root<');
    expect(rendered).toContain('class="x-ava">A<');
    // `thread` só no primeiro; `acoes: false` some com a fileira de ícones.
    expect(rendered.match(/x-post x-thread/g)).toHaveLength(1);
    expect(rendered.match(/<div class="x-actions"/g)).toHaveLength(1);
  });

  // Carimbo no nascimento: sem ele a marca do projeto é "o que a config global
  // disser NA HORA em que o agente rodar" — e a global muda a cada criação.
  describe('carimbo de marca na criação', () => {
    async function makeHomeWithBrand(slug: string): Promise<string> {
      const home = makePieceDir();
      process.env.MAQUINA_CARROSSEL_HOME = home;
      const brandDir = path.join(home, 'marcas', slug);
      await mkdir(brandDir, { recursive: true });
      await writeFile(
        path.join(brandDir, 'brand.json'),
        JSON.stringify({
          $schema: 'brandpack/v1',
          slug,
          nome: slug.toUpperCase(),
          handle: `@${slug}`,
          visual_tokens: { cores: { primaria: '#0057FF' } },
        }),
        'utf8',
      );
      return home;
    }

    async function createCarousel(payload: Record<string, unknown>) {
      const resp = await fetch(`${baseUrl}/api/projects/carousel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return { resp, body: (await resp.json()) as any };
    }

    async function readStamp(projectId: string): Promise<string | null> {
      try {
        const raw = await readFile(path.join(materializedDir(projectId), '.marca.json'), 'utf8');
        return JSON.parse(raw).marca;
      } catch {
        return null;
      }
    }

    it('carimba a marca escolhida no metadata e no disco', async () => {
      await makeHomeWithBrand('acme');
      try {
        const { resp, body } = await createCarousel({ theme: 'Tema', marca: 'acme' });
        expect(resp.status).toBe(200);
        expect(body.project.metadata.marca).toBe('acme');
        // O arquivo é o que o AGENTE lê — sem ele o texto sai com a voz errada.
        expect(await readStamp(body.project.id)).toBe('acme');
      } finally {
        delete process.env.MAQUINA_CARROSSEL_HOME;
      }
    });

    it('carimba a marca ativa quando o cliente não manda marca', async () => {
      const home = await makeHomeWithBrand('acme');
      try {
        await writeFile(
          path.join(home, 'config.json'),
          JSON.stringify({ marca_ativa: 'acme' }),
          'utf8',
        );
        // Caminho do chip da home, que não conhece marca: o daemon carimba.
        const { resp, body } = await createCarousel({ theme: 'Tema' });
        expect(resp.status).toBe(200);
        expect(body.project.metadata.marca).toBe('acme');
        expect(await readStamp(body.project.id)).toBe('acme');
      } finally {
        delete process.env.MAQUINA_CARROSSEL_HOME;
      }
    });

    it('cria o projeto normalmente quando não há marca nenhuma', async () => {
      // Home vazio: instalação nova. Criar carrossel nunca pode falhar por
      // problema de marca — o render cai no Root e a skill faz o intake.
      process.env.MAQUINA_CARROSSEL_HOME = makePieceDir();
      try {
        const { resp, body } = await createCarousel({ theme: 'Tema' });
        expect(resp.status).toBe(200);
        expect(body.project.metadata.marca).toBeUndefined();
        expect(await readStamp(body.project.id)).toBeNull();
      } finally {
        delete process.env.MAQUINA_CARROSSEL_HOME;
      }
    });

    it('recusa marca inexistente sem criar projeto', async () => {
      await makeHomeWithBrand('acme');
      try {
        const { resp } = await createCarousel({ theme: 'Tema', marca: 'nao-existe' });
        expect(resp.status).toBe(404);
      } finally {
        delete process.env.MAQUINA_CARROSSEL_HOME;
      }
    });
  });

  it('PUT /carousel refuses image refs escaping the project dir', async () => {
    const projectId = await importValidPiece();
    const got = await fetch(`${baseUrl}/api/projects/${projectId}/carousel`);
    const { document } = (await got.json()) as { document: any };
    document.slides[1].imagem = { tipo: 'local', ref: '../../../etc/hosts' };

    const put = await fetch(`${baseUrl}/api/projects/${projectId}/carousel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document }),
    });
    expect(put.status).toBe(200);
    const html = await readFile(
      path.join(materializedDir(projectId), 'deck.html'),
      'utf8',
    );
    expect(html).not.toContain('data:image/png;base64,');
    expect(html).not.toContain('etc/hosts');
  });
});
