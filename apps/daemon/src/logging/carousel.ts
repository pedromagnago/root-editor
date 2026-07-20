/**
 * Carousel pipeline structured logger (Root, Fase 1 · Camada 0).
 *
 * One JSON object per line on stdout, namespaced `carousel`, matching
 * the JSON-line convention of `logging/critique.ts` so the same log
 * pipeline ingests both. Every event carries a `traceId` minted at the
 * route boundary — import → edit → export of the same user journey can
 * be reconstructed from a single grep.
 *
 * Privacy rule (Camada 6 [F1]): events log the BOUNDARY, never the
 * content — slide counts, durations and outcomes, no headlines, no
 * document bodies, no absolute client paths beyond what the daemon
 * already prints elsewhere.
 */

export type CarouselLogEvent =
  | {
      event: 'import_succeeded';
      traceId: string;
      projectId: string;
      slides: number;
      images: number;
      durationMs: number;
    }
  | {
      event: 'import_rejected';
      traceId: string;
      reason: 'not_found' | 'invalid_json' | 'contract';
      problems: number;
      durationMs: number;
    }
  | {
      event: 'edit_succeeded';
      traceId: string;
      projectId: string;
      slides: number;
      durationMs: number;
    }
  | {
      event: 'edit_rejected';
      traceId: string;
      projectId: string;
      reason: 'contract' | 'bad_request';
      problems: number;
      durationMs: number;
    }
  | {
      event: 'export_succeeded';
      traceId: string;
      projectId: string;
      format: string;
      slides: number;
      targetWidth: number | null;
      durationMs: number;
      bytes: number;
    }
  | {
      event: 'export_failed';
      traceId: string;
      projectId: string;
      format: string;
      reason: string;
      durationMs: number;
    }
  | {
      event: 'autorender';
      traceId: string;
      projectId: string;
      slides: number;
      firstRender: boolean;
      durationMs: number;
    }
  | {
      event: 'autorender_rejected';
      traceId: string;
      projectId: string;
      reason: 'contract';
      problems: number;
      durationMs: number;
    }
  // A marca pedida não pôde ser usada e o render caiu para outra. Emitido no
  // caminho de render (import, edição e autorender), não na resolução — é lá
  // que existe traceId. `requested` carrega SLUG, nunca caminho: o ref que a
  // skill grava contém o home do cliente (regra de privacidade acima), e
  // `requestedKind` preserva o que a omissão perderia.
  | {
      event: 'brand_degraded';
      traceId: string;
      projectId: string;
      requestedKind: 'slug' | 'absolute_path' | 'relative_path' | 'none';
      requested: string | null;
      resolved: string | null;
      source: 'deck_ref' | 'project_marca' | 'active' | 'root' | 'baked';
      reason: 'brand_dir_missing' | 'brand_outside_root' | 'ref_not_absolute' | 'brand_json_unreadable' | null;
      /** Marca aplicada porém sem skin.css — deck sai meio-marcado, plausível. */
      skinMissing: boolean;
    };

export function logCarousel(e: CarouselLogEvent): void {
  const line = JSON.stringify({
    ...e,
    namespace: 'carousel',
    timestamp: new Date().toISOString(),
  });
  process.stdout.write(line + '\n');
}
