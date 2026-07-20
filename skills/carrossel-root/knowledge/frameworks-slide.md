# Frameworks de Slide (referência interna)

Os 5 frameworks de carrossel disponíveis na Etapa 4. Cada um define a sequência de slides (papel + fundo) que o `redator` preenche e o render desenha. **Genéricos** — servem para qualquer marca; a voz e as cores vêm do brand pack. `bg` ∈ `light | dark | gradient | alert`. Regra de ritmo: alternar fundos, **nunca 3 slides iguais consecutivos**; último slide sem seta e progress 100%.

Menu impresso na Etapa 4:

```
1) A Armadilha (6 slides)      — expõe um custo oculto / prática predatória do setor
2) O Raio-X (7 slides)         — diagnóstico: o leitor se autoanalisa
3) Dados que Decidem (6 slides)— uma estatística sustenta a peça inteira
4) Caso na Prática (6 slides)  — bastidor/método aplicado, humaniza a marca
5) Nicho Attack (7 slides)     — dor específica de um segmento

Escolhe 1–5.
```

Sugestão de escolha automática (`--auto`) a partir do ângulo dominante: ângulo de "custo invisível/predatório" → 1; "autodiagnóstico/método" → 2; "uma estatística-bomba" → 3; "case/bastidor" → 4; "segmento específico" → 5.

---

## 1) A Armadilha (6 slides)

Conteúdo provocativo que expõe custos ocultos e práticas predatórias do setor, com dados reais. O antagonista é a prática/sistema — nunca o leitor.

| # | Papel | bg | Conteúdo | Componentes |
|---|---|---|---|---|
| 1 | HOOK | alert | Frase que choca + número do custo oculto. Capa. | `tag`, número de impacto |
| 2 | CONTEXTO | dark | O cenário: o que se faz hoje sem perceber o risco. | — |
| 3 | A ARMADILHA | light | O custo oculto em números grandes. | `data-pill.danger`, `strike-pill`, `source-badge` |
| 4 | PROVA | dark | Caso real anonimizado ou dado de fonte oficial. | `data-pill`, `insight-box`, `source-badge` |
| 5 | A SAÍDA | gradient | O que fazer — solução prática. | `feature-list` ou `numbered-steps` |
| 6 | AÇÃO | dark | Fechamento + CTA. | `cta-button` |

## 2) O Raio-X (7 slides)

Ensina o leitor a fazer uma autoanálise rápida. Gera salvamento.

| # | Papel | bg | Conteúdo | Componentes |
|---|---|---|---|---|
| 1 | HOOK | light | Pergunta provocativa de autodiagnóstico. Capa. | `tag` |
| 2 | O PROBLEMA | dark | O que acontece quando não se sabe. | `insight-box` |
| 3 | MÉTODO (1) | light | Passo 1. | `numbered-steps` |
| 4 | MÉTODO (2) | dark | Passo 2. | `numbered-steps` |
| 5 | MÉTODO (3) | light | Passo 3. | `numbered-steps` |
| 6 | RESULTADO | gradient | O que muda quando se aplica. | `feature-list` |
| 7 | CTA | dark | Chamada final. | `cta-button` |

## 3) Dados que Decidem (6 slides)

Uma estatística sustenta a peça inteira. Autoridade por dado.

| # | Papel | bg | Conteúdo | Componentes |
|---|---|---|---|---|
| 1 | NÚMERO GIGANTE | dark | A estatística de impacto (fonte 42–60px). Capa. | número de impacto, `source-badge` |
| 2 | CONTEXTO | light | O que esse número significa. | `data-pill` |
| 3 | DESDOBRAMENTO | dark | Implicação do dado. | `insight-box` |
| 4 | COMPARAÇÃO | light | Tabela/contraste de dados. | tabela, `strike-pill` |
| 5 | INSIGHT | gradient | A conclusão (a leitura da marca). | `insight-box` |
| 6 | CTA | light | Engajamento + CTA. | `cta-button` |

## 4) Caso na Prática (6 slides)

Mostra um método aplicado / bastidor. Humaniza a marca. Caso real **anonimizado** — nunca empresa inventada.

| # | Papel | bg | Conteúdo | Componentes |
|---|---|---|---|---|
| 1 | O PROBLEMA DO CASO | light | A situação inicial (anonimizada). Capa. | `tag` |
| 2 | DIAGNÓSTICO | dark | O que se descobriu. | `insight-box` |
| 3 | O MÉTODO | light | Como foi resolvido (passos). | `numbered-steps` |
| 4 | RESULTADO | gradient | O resultado em número. | `data-pill.success`, `strike-pill` |
| 5 | FALA | dark | Fala anonimizada do protagonista. | `insight-box` |
| 6 | CTA | light | Chamada final. | `cta-button` |

## 5) Nicho Attack (7 slides)

Carrossel específico para um segmento, usando o vocabulário e as dores dele.

| # | Papel | bg | Conteúdo | Componentes |
|---|---|---|---|---|
| 1 | DOR NO VOCABULÁRIO | alert | A dor específica do nicho. Capa. | `tag.niche` |
| 2 | "ISSO É COMIGO" | dark | Reconhecimento sem culpa. | — |
| 3 | CAUSA | light | A causa estrutural. | `insight-box` |
| 4 | MECÂNICA | dark | "Parece X, na prática é Y." | `strike-pill` |
| 5 | PROVA | light | Dado/caso do nicho. | `data-pill`, `source-badge` |
| 6 | ATALHO | gradient | A saída prática. | `feature-list` |
| 7 | CTA | dark | Chamada final. | `cta-button` |

---

## 6) A Thread (7 slides)

A tese contada como uma sequência de posts, um por slide. Funciona quando a ideia **é uma cadeia de raciocínio** — cada passo depende do anterior — e o formato de timeline dá a sensação de estar lendo alguém pensando alto, não uma apresentação.

Escolha este quando a espinha tem um encadeamento lógico forte (A leva a B leva a C) e a prova é de argumento, não de número. **Não escolha** quando a peça é sustentada por dados: `x-post` não tem onde colocar `data-pill` com destaque, e a estatística some no corpo do texto — nesse caso use "Dados que Decidem".

| # | Papel | bg | Conteúdo | Componentes |
|---|---|---|---|---|
| 1 | CAPA | dark | A tese em headline curta. **Capa não renderiza componentes** — aqui é só headline, como em todo template. | — |
| 2 | O POST DE ABERTURA | dark | A tese inteira em uma frase, como o post que abriu a thread. | `x-post` (thread) |
| 3 | O MECANISMO | dark | Por que acontece. O passo que sustenta o resto. | `x-post` (thread) |
| 4 | A OBJEÇÃO | alert | "Mas e quando…" — antecipa a discordância do leitor. | `x-post` (thread) |
| 5 | A RESPOSTA | dark | Desmonta a objeção com evidência ou caso. | `x-post` (thread), `source-badge` |
| 6 | A CONSEQUÊNCIA | gradient | O que muda para quem entendeu. Fecha a thread. | `x-post` |
| 7 | CTA | dark | Chamada final — **fora do card**, é a marca falando, não o post. | `cta-button` |

Regras próprias deste template:
- **O card começa no slide 2.** A capa tem caminho de render próprio e ignora `componentes` — pôr `x-post` nela não desenha nada.
- Slides 2–5 levam `thread: true`; o 6 não (encerra o fio). Os slides 1 e 7 não têm `x-post`.
- O texto do card **é** o slide: não use `blocos` junto, senão o mesmo conteúdo aparece duas vezes.
- Cada card em uma ideia só, e curto — texto de post não passa de 2 ou 3 linhas. Se precisou de mais, é outro slide.
- Fundo escuro na maioria, para o card ler como timeline. O `alert` no 4 marca a virada da objeção.

---

## Regras universais (qualquer framework)
- 1 ideia por slide; no máximo 2 blocos de texto por slide.
- Densidade decrescente: menos texto no começo.
- Todo número com **fonte + ano** (ou marcado "exemplo ilustrativo").
- CTA único, só no último slide; coerente com a oferta do brand pack.
- Último slide: sem seta de swipe, progress bar em 100%.
- A capa preserva coerência com a headline escolhida na Etapa 2.
