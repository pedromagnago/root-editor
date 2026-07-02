import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { startCarouselAutoRender, isCarouselProject } from '../src/carousel-autorender.js';

// The real chokidar wiring is validated live (a slides.json write on disk
// triggers a re-render); FSEvents inside vitest workers does not reliably
// deliver in-place file modifies, so here we inject a controllable fake
// watcher and drive its callback directly. This keeps the service's logic
// — validate, render, first-render bootstrap, own-write skip, reject-keeps —
// fully deterministic.

function validDeck(): Record<string, unknown> {
  return {
    meta: { handle: '@root', framework: 'raio-x', tema: 'Auto render' },
    slides: [
      { ordem: 1, bg: 'dark', papel: 'hook', tipo: 'capa', headline: 'Capa' },
      { ordem: 2, bg: 'dark', papel: 'prova', headline: 'Dois', blocos: ['b'] },
      { ordem: 3, bg: 'alert', papel: 'virada', headline: 'Tres' },
      {
        ordem: 4,
        bg: 'dark',
        papel: 'cta',
        tipo: 'fechamento',
        headline: 'Fim',
        cta: { instrucao: 'Comente', palavra: 'ROOT' },
      },
    ],
  };
}

describe('isCarouselProject', () => {
  it('matches imported, chat-created, and skill-driven carousels only', () => {
    expect(isCarouselProject({ metadata: { importedFrom: 'carousel' } })).toBe(true);
    expect(isCarouselProject({ metadata: { carousel: true } })).toBe(true);
    expect(isCarouselProject({ skillId: 'carrossel-root' })).toBe(true);
    expect(isCarouselProject({ skillId: 'ad-creative', metadata: { importedFrom: 'folder' } })).toBe(false);
    expect(isCarouselProject({})).toBe(false);
    expect(isCarouselProject({ metadata: null })).toBe(false);
  });
});

describe('carousel auto-render service', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function harness(store: Map<string, any>) {
    const projectsDir = mkdtempSync(path.join(tmpdir(), 'od-autorender-'));
    roots.push(projectsDir);
    // Fake watcher: capture the per-project callback so the test can fire an
    // event on demand. Awaiting `settle()` drains the render queue.
    const callbacks = new Map<string, (evt: any) => void>();
    let pending: Promise<void> = Promise.resolve();
    const svc = startCarouselAutoRender({
      projectsDir,
      projectDir: (root, id) => path.join(root, id),
      listProjects: () => Array.from(store.values()),
      getProject: (id) => store.get(id),
      updateProject: (id, patch) => {
        const p = store.get(id);
        if (p) store.set(id, { ...p, ...patch });
      },
      setTabs: (id, tabs, active) => {
        const p = store.get(id);
        if (p) p.tabs = { tabs, active };
      },
      subscribe: ((_root: string, pid: string, cb: (evt: any) => void) => {
        callbacks.set(pid, cb);
        return { unsubscribe: () => callbacks.delete(pid), ready: Promise.resolve() };
      }) as any,
      randomId: () => 't',
    });
    const fire = (id: string, file = 'slides.json', kind: 'add' | 'change' | 'unlink' = 'change') => {
      callbacks.get(id)?.({ type: 'file-changed', path: file, kind });
      // The service schedules renders on a per-project promise chain; give the
      // microtasks + fs writes a beat to drain before assertions.
      pending = pending.then(() => new Promise((r) => setTimeout(r, 50)));
      return pending;
    };
    return { svc, projectsDir, fire };
  }

  it('re-renders deck.html when slides.json changes', async () => {
    const store = new Map<string, any>();
    const id = 'p1';
    store.set(id, { id, name: 'Deck', metadata: { importedFrom: 'carousel', entryFile: 'deck.html' } });
    const { svc, projectsDir, fire } = harness(store);
    const dir = path.join(projectsDir, id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'deck.html'), '<html>old</html>', 'utf8');
    await writeFile(path.join(dir, 'deck.html.artifact.json'), '{}', 'utf8');

    svc.ensureWatching(id);
    const edited = validDeck();
    (edited.slides as any)[0].headline = 'Headline auto-render <em>viva</em>';
    await writeFile(path.join(dir, 'slides.json'), JSON.stringify(edited), 'utf8');
    await fire(id);
    await new Promise((r) => setTimeout(r, 80));

    const html = await readFile(path.join(dir, 'deck.html'), 'utf8');
    expect(html).toContain('Headline auto-render');
    expect(html).toContain('<em>viva</em>');
    expect(html.match(/class="slide /g)?.length).toBe(4);
  });

  it('bootstraps a chat-created project on first slides.json write', async () => {
    const store = new Map<string, any>();
    const id = 'p2';
    store.set(id, { id, name: 'Novo', metadata: { carousel: true } });
    const { svc, projectsDir, fire } = harness(store);
    const dir = path.join(projectsDir, id);
    await mkdir(dir, { recursive: true });

    svc.ensureWatching(id);
    await writeFile(path.join(dir, 'slides.json'), JSON.stringify(validDeck()), 'utf8');
    await fire(id, 'slides.json', 'add');
    await new Promise((r) => setTimeout(r, 80));

    await stat(path.join(dir, 'deck.html'));
    const manifest = JSON.parse(await readFile(path.join(dir, 'deck.html.artifact.json'), 'utf8'));
    expect(manifest.kind).toBe('deck');
    expect(manifest.metadata.source).toBe('carousel');
    expect(store.get(id).metadata.importedFrom).toBe('carousel');
    expect(store.get(id).tabs).toEqual({ tabs: ['deck.html'], active: 'deck.html' });
  });

  it('skips the render its own route already produced (noteRendered)', async () => {
    const store = new Map<string, any>();
    const id = 'p3';
    store.set(id, { id, name: 'Deck', metadata: { importedFrom: 'carousel', entryFile: 'deck.html' } });
    const { svc, projectsDir, fire } = harness(store);
    const dir = path.join(projectsDir, id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'deck.html'), 'SENTINEL', 'utf8');
    await writeFile(path.join(dir, 'deck.html.artifact.json'), '{}', 'utf8');

    const raw = JSON.stringify(validDeck());
    svc.noteRendered(id, raw);
    svc.ensureWatching(id);
    await writeFile(path.join(dir, 'slides.json'), raw, 'utf8');
    await fire(id);
    await new Promise((r) => setTimeout(r, 80));

    expect(await readFile(path.join(dir, 'deck.html'), 'utf8')).toBe('SENTINEL');
  });

  it('leaves the previous deck when the agent writes an invalid contract', async () => {
    const store = new Map<string, any>();
    const id = 'p4';
    store.set(id, { id, name: 'Deck', metadata: { importedFrom: 'carousel', entryFile: 'deck.html' } });
    const { svc, projectsDir, fire } = harness(store);
    const dir = path.join(projectsDir, id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'deck.html'), 'GOOD-DECK', 'utf8');
    await writeFile(path.join(dir, 'deck.html.artifact.json'), '{}', 'utf8');

    svc.ensureWatching(id);
    await writeFile(
      path.join(dir, 'slides.json'),
      JSON.stringify({ meta: { handle: '@root', framework: 'raio-x' }, slides: [
        { ordem: 1, bg: 'dark', papel: 'hook' },
        { ordem: 2, bg: 'dark', papel: 'x' },
      ] }),
      'utf8',
    );
    await fire(id);
    await new Promise((r) => setTimeout(r, 80));

    expect(await readFile(path.join(dir, 'deck.html'), 'utf8')).toBe('GOOD-DECK');
  });
});
