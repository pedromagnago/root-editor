import type http from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
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
