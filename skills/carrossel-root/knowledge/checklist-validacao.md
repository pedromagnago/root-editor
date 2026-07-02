# Checklist de Validação (referência interna)

Dois usos: o `revisor-qa` aplica o **bloco A (copy)**; o `validador-visual` aplica os **blocos B (visual) e C (aderência ao brief)** olhando o `preview.html` renderizado. Reprovar qualquer item duro = volta ao redator/render (máx 2 ciclos). Os 7 parâmetros de QA com notas/penalidades estão em `manual-qualidade.md`; as proibições de copy em `filtro-anti-slop.md`.

## Bloco A — Copy (revisor-qa)
- [ ] Tudo em PT-BR.
- [ ] 1 ideia por slide; **no máximo 2 blocos** de texto por slide (nunca 3).
- [ ] Bloco 1 contextualiza; bloco 2 aprofunda ou contradiz.
- [ ] Todo número/estatística com **número + fonte + ano** (ou marcado "exemplo ilustrativo").
- [ ] Nenhum slide termina em afirmação fechada — sempre deixa abertura para o próximo (exceto o CTA).
- [ ] O slide anterior ao CTA prepara narrativamente o fechamento — não pula direto pra "comenta X".
- [ ] Hook (slide 2) conecta diretamente com a headline da capa.
- [ ] Headline passou no checklist de rejeição (`banco-de-headlines.md`), sem palavra proibida (`filtro-anti-slop.md`).
- [ ] Sem 2ª pessoa onde a marca proíbe; respeita `rules.aprovados`/`proibidos` do brand pack.
- [ ] Provocação por descoberta — o leitor nunca é o vilão.
- [ ] CTA único, coerente com a oferta da marca, diretivo (não cordial).
- [ ] 7 parâmetros de QA ≥ 8/10 cada (`manual-qualidade.md`).

## Bloco B — Visual (validador-visual, olhando o preview)
- [ ] Alternância de fundos clara; **nunca 3 slides iguais** consecutivos.
- [ ] Progress bar avança corretamente; **último slide em 100% e SEM seta** de swipe.
- [ ] Watermark/handle da marca em todos os slides.
- [ ] Número de impacto visível e grande (42–60px no design), não enterrado no corpo.
- [ ] Hierarquia de 3 níveis legível; contraste texto/fundo suficiente.
- [ ] Sem overflow: nenhum texto cortado, headline ≤ 4 linhas, nada sobrepondo progress/watermark.
- [ ] Componente certo para o conteúdo (dado isolado→data-pill; 3+ dados→tabela; passos→numbered-steps).
- [ ] Cores da paleta da marca; primária não usada como fundo de texto corrido.
- [ ] Dimensão 1080×1350 (4:5).
- [ ] Capa coerente com a headline escolhida.

## Bloco C — Aderência ao brief / insumo (validador-visual)
O ponto central: **o carrossel saiu como foi pedido?**
- [ ] A tese do carrossel é a mesma da **Espinha Dorsal** aprovada (não derivou).
- [ ] Cumpriu o que a headline/ hook prometeu (se prometeu "3 coisas", entrega 3).
- [ ] Usou as **evidências do insumo** (os dados/casos que vieram na triagem), não inventou outros.
- [ ] Se o usuário pediu algo específico no insumo (ângulo, dado, nicho, CTA), está refletido.
- [ ] O eixo/ângulo dominante da triagem está visível no resultado.

## Veredito
- **Aprovado:** todos os itens duros OK → seguir para legenda/entrega.
- **Reprovado:** listar, por slide, o que falhou e a correção objetiva → devolver ao `redator` (problema de copy) ou ao `designer-render` (problema de layout). Máx 2 ciclos; esgotado, entregar o melhor estado com o relatório de pendências exposto ao usuário.

## Legenda (gerada após aprovação)
- [ ] 1ª linha = hook (antes do "...mais").
- [ ] 3–5 parágrafos curtos, na voz da marca.
- [ ] Dado/exemplo com fonte quando aplicável.
- [ ] CTA + 8–12 hashtags relevantes.
- [ ] Linha final: "Post produzido com ajuda de Inteligência Artificial."
