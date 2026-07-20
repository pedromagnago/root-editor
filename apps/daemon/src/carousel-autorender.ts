// Carousel auto-render service.
//
// A carousel project's deck.html is a projection of slides.json. When the
// client's Claude Code (running the carrossel-root skill in the project cwd)
// writes slides.json, the agent has no idea about daemon ports or routes — it
// just writes the contract. This service closes that gap: it watches carousel
// projects and re-renders deck.html whenever slides.json changes on disk,
// through the exact pipeline behind import and PUT /carousel.
//
// It reuses the project file watcher (project-watchers.ts) keyed by directory,
// so it shares one chokidar instance with any open SSE preview subscription —
// no extra descriptors. Re-entrancy is bounded: it only reacts to slides.json,
// and writing deck.html never trips a slides.json event. Its own renders and
// the routes' renders are suppressed via a per-project content marker, so the
// only render is the one triggered by an external (agent) write.

import path from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

import { normalizeBrandRef } from './carousel-brand.js';
import {
  CarouselContractError,
  carouselArtifactJson,
  logBrandDegradation,
  parseCarouselSlides,
  writeCarouselDeck,
} from './carousel-import.js';
import { logCarousel } from './logging/carousel.js';

const CAROUSEL_ENTRY = 'deck.html';

// The bundled skill that runs the editorial pipeline and writes slides.json.
// A project carrying it is a carousel even before its first render.
export const CARROSSEL_SKILL_ID = 'carrossel-root';

export interface CarouselAutoRender {
  ensureWatching(projectId: string): void;
  // Records the slides.json content a route just rendered, so the watcher
  // skips the redundant re-render its own write would otherwise trigger.
  noteRendered(projectId: string, slidesRaw: string): void;
  stop(): Promise<void>;
}

interface ProjectRow {
  id: string;
  name?: string;
  skillId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CarouselAutoRenderDeps {
  projectsDir: string;
  projectDir: (projectsRoot: string, projectId: string) => string;
  listProjects: () => ProjectRow[];
  getProject: (id: string) => ProjectRow | undefined;
  updateProject: (id: string, patch: Record<string, unknown>) => void;
  setTabs: (id: string, tabs: string[], active: string | null) => void;
  subscribe: (
    projectsRoot: string,
    projectId: string,
    onEvent: (evt: { type: 'file-changed'; path: string; kind: 'add' | 'change' | 'unlink' }) => void,
    opts?: Record<string, unknown>,
  ) => { unsubscribe: () => Promise<void> | void; ready: Promise<void> };
  randomId: () => string;
}

export function isCarouselProject(project: {
  skillId?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  if (project.skillId === CARROSSEL_SKILL_ID) return true;
  const metadata = project.metadata;
  if (!metadata) return false;
  return metadata.importedFrom === 'carousel' || metadata.carousel === true;
}

export function startCarouselAutoRender(deps: CarouselAutoRenderDeps): CarouselAutoRender {
  const subs = new Map<string, { unsubscribe: () => Promise<void> | void }>();
  const lastRendered = new Map<string, string>();
  // Serialize renders per project: chokidar can fire several events for one
  // logical edit, and a burst must never drop the final state. Each event
  // enqueues a render after the previous completes; the content check makes
  // redundant enqueues cheap no-ops.
  const inFlight = new Map<string, Promise<void>>();

  function noteRendered(projectId: string, slidesRaw: string): void {
    lastRendered.set(projectId, slidesRaw);
  }

  async function renderOnce(projectId: string): Promise<void> {
    const project = deps.getProject(projectId);
    if (!project) return;
    const dir = deps.projectDir(deps.projectsDir, projectId);
    const slidesPath = path.join(dir, 'slides.json');
    let raw: string;
    try {
      raw = await readFile(slidesPath, 'utf8');
    } catch {
      return;
    }
    if (lastRendered.get(projectId) === raw) return;

    const traceId = deps.randomId();
    const startedAt = Date.now();
    let deck;
    try {
      deck = parseCarouselSlides(JSON.parse(raw));
    } catch (err) {
      if (err instanceof CarouselContractError) {
        logCarousel({
          event: 'autorender_rejected',
          traceId,
          projectId,
          reason: 'contract',
          problems: err.problems.length,
          durationMs: Date.now() - startedAt,
        });
      }
      // Leave the previous deck.html in place; the agent's next write gets
      // another chance without stranding a half-broken preview.
      return;
    }

    const metadata = (project.metadata ?? {}) as Record<string, unknown>;
    const projectMarca = typeof metadata.marca === 'string' ? metadata.marca : null;

    // O agente grava `brand_pack_ref` como caminho absoluto (SKILL.md §contrato).
    // Caminho absoluto não é portável entre máquinas, e o invariante declarado
    // em carousel-brand.ts diz que o working copy guarda slug. O import já
    // normalizava; este é o caminho REAL de produção e não normalizava nada.
    //
    // Divergência deliberada em relação ao import: quando o ref não resolve, o
    // import APAGA o campo — é primeiro contato com entrada externa, e derrubar
    // um ref hostil é o certo. Aqui nós PRESERVAMOS: é o working copy do
    // usuário, e uma falha transitória (marca renomeada, pasta movida) não pode
    // destruir a intenção dele de forma irreversível. O render cai no fallback
    // e o `brand_degraded` registra o motivo.
    let effectiveRaw = raw;
    const normalized = normalizeBrandRef(deck.brand_pack_ref);
    if (normalized && normalized !== deck.brand_pack_ref) {
      deck.brand_pack_ref = normalized;
      const rewritten = JSON.stringify(deck, null, 2);
      // Guarda de concorrência: o agente pode ter reescrito slides.json
      // enquanto normalizávamos. Só persistimos se o disco ainda for o que
      // lemos — senão sobrescreveríamos a versão mais nova dele.
      let current: string | null = null;
      try {
        current = await readFile(slidesPath, 'utf8');
      } catch {
        current = null;
      }
      if (current === raw) {
        await writeFile(slidesPath, rewritten, 'utf8');
        effectiveRaw = rewritten;
      }
    }

    const rendered = await writeCarouselDeck(dir, CAROUSEL_ENTRY, deck, undefined, {
      projectMarca,
    });
    logBrandDegradation(rendered.brand, { traceId, projectId });
    // Tem que ser o conteúdo EFETIVAMENTE no disco: se guardássemos `raw`, a
    // nossa própria escrita de normalização dispararia o watcher e geraria um
    // segundo render (auto-terminante, mas desperdiçado e com log duplicado).
    lastRendered.set(projectId, effectiveRaw);

    // First render of a chat-created project: it has no deck manifest yet
    // and is not marked a carousel import. Materialize both so the viewer
    // renders it as a deck and the edit panel gates on.
    const firstRender = !existsSync(path.join(dir, `${CAROUSEL_ENTRY}.artifact.json`));
    if (firstRender) {
      const name = project.name?.trim() || deck.meta.tema?.trim() || 'Carrossel';
      await writeFile(
        path.join(dir, `${CAROUSEL_ENTRY}.artifact.json`),
        JSON.stringify(carouselArtifactJson(name, CAROUSEL_ENTRY, new Date(startedAt).toISOString()), null, 2),
        'utf8',
      );
    }
    if (metadata.importedFrom !== 'carousel') {
      deps.updateProject(projectId, {
        metadata: { ...metadata, carousel: true, importedFrom: 'carousel', entryFile: CAROUSEL_ENTRY },
      });
      deps.setTabs(projectId, [CAROUSEL_ENTRY], CAROUSEL_ENTRY);
    }
    logCarousel({
      event: 'autorender',
      traceId,
      projectId,
      slides: deck.slides.length,
      firstRender,
      durationMs: Date.now() - startedAt,
    });
  }

  function schedule(projectId: string): void {
    const prev = inFlight.get(projectId) ?? Promise.resolve();
    const next = prev
      .then(() => renderOnce(projectId))
      .catch(() => {
        // A transient fs error leaves slides.json intact; a later write retries.
      })
      .finally(() => {
        if (inFlight.get(projectId) === next) inFlight.delete(projectId);
      });
    inFlight.set(projectId, next);
  }

  function ensureWatching(projectId: string): void {
    if (subs.has(projectId)) return;
    // Watch the materialized project dir directly (no metadata → projectDir):
    // carousel decks always live under PROJECTS_DIR, never an external baseDir.
    const sub = deps.subscribe(deps.projectsDir, projectId, (evt) => {
      if (evt.kind === 'unlink') return;
      if (path.basename(evt.path) !== 'slides.json') return;
      schedule(projectId);
    });
    subs.set(projectId, sub);
  }

  for (const project of deps.listProjects()) {
    if (isCarouselProject(project)) ensureWatching(project.id);
  }

  async function stop(): Promise<void> {
    const all = Array.from(subs.values());
    subs.clear();
    await Promise.all(all.map((s) => Promise.resolve(s.unsubscribe()).catch(() => {})));
  }

  return { ensureWatching, noteRendered, stop };
}
