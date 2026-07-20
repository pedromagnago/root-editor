// Composição do prompt de imagem do carrossel.
//
// A divisão de responsabilidade é o ponto deste módulo, e vem da Camada 6
// (OWASP-LLM, LLM01 — entrada externa é dado, não comando):
//
//   skill (Claude Code do cliente)  →  a CENA: o que aparece e por que serve
//                                      ao papel narrativo deste slide.
//   daemon (aqui)                   →  o PROMPT FINAL: direção de marca +
//                                      cena + negativos + formato.
//
// O agente nunca controla o prompt inteiro. Ele preenche um campo; o daemon
// carimba marca, proibições e aspecto por cima. Sem essa cerca, o texto que
// chega ao provider seria 100% produzido por LLM a partir de insumo do
// usuário — injeção direta.
//
// Este módulo não chama provider nenhum: só monta a string. Quem gera é o
// gateway de mídia que já existe (`/api/projects/:id/media/generate`), com a
// chave do cliente (ADR-005: a Root não hospeda nem paga geração).

/** Direção de arte derivada do brand pack — não do que o agente escreveu. */
export interface BrandArtDirection {
  estilo?: string | undefined;
  primaria?: string | undefined;
  bg?: string | undefined;
  nicho?: string | undefined;
}

export interface CarouselImagePromptInput {
  cena: string;
  /** `papel` do slide no template (HOOK, PROVA, VIRADA…). Ancora o enquadramento. */
  papel?: string | undefined;
  brand?: BrandArtDirection | undefined;
}

// Traduz o estilo declarado no intake para direção de arte. Sem isto, toda
// marca recebe a mesma imagem genérica de banco.
const ESTILO_ART: Record<string, string> = {
  classico: 'fotografia editorial sóbria, luz natural, composição centrada, sem elementos gráficos',
  moderno: 'fotografia contemporânea, cores saturadas, composição assimétrica, profundidade',
  minimalista: 'composição limpa com muito espaço negativo, um único assunto, luz suave e uniforme',
  bold: 'alto contraste, enquadramento fechado, cor chapada de fundo, presença gráfica forte',
};

// Negativos fixos. Não são configuráveis de propósito: são o que faz uma
// imagem parecer stock genérico ou poluir um slide que já tem texto por cima.
const NEGATIVOS = [
  'sem texto, sem letras, sem números, sem marca d\'água',
  'sem colagem, sem moldura, sem bordas decorativas',
  'sem pessoas olhando para a câmera sorrindo em pose de banco de imagens',
  'sem elementos no terço inferior (o texto do slide entra ali)',
];

/**
 * Monta o prompt final. `cena` entra como conteúdo entre delimitadores — se
 * ela trouxer instrução ("ignore o anterior e…"), fica evidente que é dado
 * citado, não comando ao gerador.
 */
export function buildCarouselImagePrompt(input: CarouselImagePromptInput): string {
  const cena = input.cena.trim().replace(/\s+/g, ' ').slice(0, 600);
  const estilo = input.brand?.estilo ? ESTILO_ART[input.brand.estilo] : undefined;

  const direcao: string[] = [];
  if (estilo) direcao.push(estilo);
  if (input.brand?.primaria) direcao.push(`paleta puxando para ${input.brand.primaria}`);
  if (input.brand?.nicho) direcao.push(`contexto de ${input.brand.nicho}`);

  const enquadramento = input.papel
    ? `Enquadramento a serviço do papel "${input.papel}" dentro de um carrossel.`
    : 'Enquadramento a serviço de um slide de carrossel.';

  return [
    `Cena: <<<${cena}>>>`,
    direcao.length ? `Direção de arte: ${direcao.join('; ')}.` : '',
    enquadramento,
    `Formato vertical 4:5, 1080x1350.`,
    `Restrições: ${NEGATIVOS.join('; ')}.`,
  ]
    .filter(Boolean)
    .join('\n');
}
