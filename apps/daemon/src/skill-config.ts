// Configuração de skill exposta no produto (`od.config`).
//
// Duas responsabilidades, deliberadamente separadas de `skills.ts`:
//
// 1. RESOLVER OPÇÕES DINÂMICAS. A lista de marcas do cliente não cabe no
//    frontmatter — ela muda em runtime. O frontmatter declara só o NOME da
//    fonte (`options_source: carousel-brands`) e este módulo faz o de-para.
//    Assim `skills.ts` nunca importa nada de carrossel, e `GET /api/skills`
//    (que re-escaneia o disco a cada request, por design) não ganha um scan
//    de brand packs por chamada.
//
// 2. DELEGAR A PERSISTÊNCIA. Este é o ponto crítico: a marca ativa JÁ tem uma
//    fonte da verdade em `~/.maquina-carrossel/config.json`, e é de lá que o
//    AGENTE lê quando roda (SKILL.md §0). Se a config do painel fosse parar em
//    `app-config.json`, o usuário trocaria a marca na UI, a UI confirmaria, e
//    o agente continuaria gerando com a marca antiga — voz, ICP e `rules`
//    errados, em silêncio. Exatamente a classe de bug que esta rodada existe
//    para matar. Por isso a rota DELEGA ao store que já existe em vez de criar
//    um segundo lugar de verdade.
//
// Um campo sem fonte declarada não tem para onde delegar; hoje isso é um
// erro de configuração da skill, não um caso de uso — o único consumidor é a
// marca. Quando surgir um campo genuinamente novo, ele ganha armazenamento
// próprio aqui, não em cima deste caminho.

import {
  activeCarouselBrandSlug,
  listCarouselBrands,
  setActiveCarouselBrand,
} from './carousel-brand.js';
import type { SkillInfo, SkillConfigFieldSpec } from './skills.js';

export interface SkillConfigOption {
  value: string;
  label: string;
}

/** Campo já resolvido para render: opções preenchidas, valor atual junto. */
export interface ResolvedSkillConfigField extends SkillConfigFieldSpec {
  options?: string[];
  optionLabels?: Record<string, string>;
  /** Fonte declarada mas desconhecida: a UI mostra o campo desabilitado. */
  unresolved?: boolean;
}

export interface SkillConfigView {
  fields: ResolvedSkillConfigField[];
  values: Record<string, unknown>;
}

interface SkillConfigSource {
  options(): Promise<SkillConfigOption[]>;
  read(): Promise<unknown>;
  write(value: unknown): Promise<void>;
}

// Mapa estático em vez de registry com `register()`: com uma fonte só, o
// registry adicionaria risco de ordem de inicialização e uma indireção que
// ninguém precisa. O ponto de extensão é literalmente uma linha aqui.
const SOURCES: Record<string, SkillConfigSource> = {
  'carousel-brands': {
    async options() {
      const brands = await listCarouselBrands();
      return brands.map((b) => ({ value: b.slug, label: b.nome || b.slug }));
    },
    read: () => activeCarouselBrandSlug(),
    async write(value: unknown) {
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('brand must be a non-empty string');
      }
      const brands = await listCarouselBrands();
      if (!brands.some((b) => b.slug === value)) {
        throw new Error(`unknown brand: ${value}`);
      }
      await setActiveCarouselBrand(value);
    },
  },
};

export function skillHasConfig(skill: SkillInfo): boolean {
  return skill.configFields.length > 0;
}

export async function resolveSkillConfig(skill: SkillInfo): Promise<SkillConfigView> {
  const fields: ResolvedSkillConfigField[] = [];
  const values: Record<string, unknown> = {};

  for (const field of skill.configFields) {
    if (!field.optionsSource) {
      fields.push(field);
      if (field.default !== undefined) values[field.name] = field.default;
      continue;
    }
    const source = SOURCES[field.optionsSource];
    if (!source) {
      // Nunca some da UI: um campo que desaparece parece "não existe", e o
      // usuário fica procurando a configuração que a skill promete.
      fields.push({ ...field, options: [], unresolved: true });
      continue;
    }
    const options = await source.options();
    fields.push({
      ...field,
      options: options.map((o) => o.value),
      optionLabels: Object.fromEntries(options.map((o) => [o.value, o.label])),
    });
    const current = await source.read();
    if (current != null) values[field.name] = current;
  }

  return { fields, values };
}

export async function applySkillConfig(
  skill: SkillInfo,
  incoming: Record<string, unknown>,
): Promise<void> {
  for (const field of skill.configFields) {
    if (!(field.name in incoming)) continue;
    if (!field.optionsSource) {
      throw new Error(`field has no configured store: ${field.name}`);
    }
    const source = SOURCES[field.optionsSource];
    if (!source) throw new Error(`unknown options source: ${field.optionsSource}`);
    await source.write(incoming[field.name]);
  }
}
