import { describe, expect, it } from 'vitest';

import {
  CarouselContractError,
  CAROUSEL_CONTRACT_VERSION,
  parseCarouselSlides,
} from '../src/carousel-import.js';

function validDeck(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...extra,
    meta: { handle: '@root', framework: 'raio-x' },
    slides: [
      { ordem: 1, bg: 'dark', papel: 'hook', tipo: 'capa', headline: 'Capa' },
      { ordem: 2, bg: 'dark', papel: 'prova', headline: 'Dois' },
      { ordem: 3, bg: 'alert', papel: 'virada', headline: 'Tres' },
      { ordem: 4, bg: 'dark', papel: 'cta', tipo: 'fechamento', headline: 'Fim' },
    ],
  };
}

describe('carousel contract versioning', () => {
  it('stamps the current version when none is given', () => {
    const deck = parseCarouselSlides(validDeck());
    expect(deck.versao).toBe(CAROUSEL_CONTRACT_VERSION);
  });

  it('preserves an explicit current version', () => {
    const deck = parseCarouselSlides(validDeck({ versao: CAROUSEL_CONTRACT_VERSION }));
    expect(deck.versao).toBe(CAROUSEL_CONTRACT_VERSION);
  });

  it('rejects a version newer than this build supports', () => {
    expect(() => parseCarouselSlides(validDeck({ versao: CAROUSEL_CONTRACT_VERSION + 1 }))).toThrow(
      CarouselContractError,
    );
    try {
      parseCarouselSlides(validDeck({ versao: CAROUSEL_CONTRACT_VERSION + 1 }));
    } catch (err) {
      expect((err as CarouselContractError).problems[0]).toContain('newer than this build');
    }
  });

  it('rejects a malformed version', () => {
    expect(() => parseCarouselSlides(validDeck({ versao: 0 }))).toThrow(CarouselContractError);
    expect(() => parseCarouselSlides(validDeck({ versao: 1.5 }))).toThrow(CarouselContractError);
  });
});
