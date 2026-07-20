# Camada 4 — Design System (Máquina de Carrossel V03 · Operação Root)

> **v0.1.** A identidade Root codificada em três camadas de tokens. Fonte canônica = `~/.maquina-carrossel/marcas/root/brand.json`. **Estes tokens espelham o `brand.json`; ele manda.** Nenhum valor visual vive solto na UI.

## 0. Duas superfícies, uma marca

O produto tem **duas superfícies visuais distintas** — as duas precisam parecer Root, mas têm tokens diferentes:

1. **Chrome do editor** (`--ui-*`) — a interface da ferramenta (barras, painéis, botões, inputs). É aqui que mora o **reskin inegociável** do Open Design. Tema escuro por padrão (bg `#070A08`).
2. **Conteúdo do carrossel** (`--slide-*`) — os slides sendo produzidos/exportados. Mapeiam direto os `render_tokens` do `brand.json` (P, PL, PD, LB, DB, LR, ALERT, OK).

As duas compartilham os **primitivos** (a paleta bruta), mas divergem no semântico. Nunca misturar: um botão do editor usa `--ui-*`; um título de slide usa `--slide-*`.

---

## 1. Camada 1 — Tokens primitivos (valores brutos)

Codificação direta do `brand.json`. Sem significado de contexto.

```css
:root {
  /* paleta Root (bruta — de brand.json visual_tokens + render_tokens) */
  --c-lime-500:    #9BDB1F;            /* primária · render P  */
  --c-lime-300:    #C4FF2E;            /* clara · sucesso · render PL/OK */
  --c-lime-900:    #1C3010;            /* escura · render PD */
  --c-mint-100:    #DFFFE8;            /* texto claro · render LB */
  --c-ink-900:     #070A08;            /* fundo · render DB */
  --c-magenta-500: #FF1F6B;            /* acento · alerta · render ALERT */
  --c-rule:        rgba(28,48,16,0.45);/* linhas/divisores · render LR */

  /* espaçamento (escala 4px) */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-6: 24px; --s-8: 32px; --s-12: 48px;

  /* tipografia (de brand.json fontes) */
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;   /* headline */
  --font-grotesk: 'Space Grotesk', ui-sans-serif, system-ui;   /* corpo */
  --fs-sm: 14px; --fs-md: 16px; --fs-lg: 20px; --fs-xl: 28px; --fs-2xl: 40px;
  --fw-regular: 400; --fw-medium: 500; --fw-bold: 700;

  /* forma */
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 14px;
  --shadow-1: 0 1px 2px rgba(0,0,0,.35);
}
```

## 2. Camada 2 — Tokens semânticos (papel)

### 2a. Chrome do editor (`--ui-*`) — tema escuro Root

```css
:root {
  --ui-bg-app:       var(--c-ink-900);     /* fundo da janela */
  --ui-bg-surface:   #0D130E;              /* painéis (derivado do ink, +luz) */
  --ui-text-primary: var(--c-mint-100);
  --ui-text-muted:   #7F9A86;              /* texto secundário */
  --ui-accent:       var(--c-lime-500);    /* assinatura: ações primárias, foco */
  --ui-danger:       var(--c-magenta-500);
  --ui-success:      var(--c-lime-300);
  --ui-border:       var(--c-rule);
  --ui-focus-ring:   var(--c-lime-500);
}
```

### 2b. Conteúdo do carrossel (`--slide-*`) — espelha `render_tokens`

```css
:root {
  --slide-bg:        var(--c-ink-900);     /* DB */
  --slide-text:      var(--c-mint-100);    /* LB */
  --slide-headline:  var(--c-lime-500);    /* P  */
  --slide-highlight: var(--c-lime-300);    /* PL */
  --slide-deep:      var(--c-lime-900);    /* PD */
  --slide-rule:      var(--c-rule);        /* LR */
  --slide-alert:     var(--c-magenta-500); /* ALERT */
  --slide-ok:        var(--c-lime-300);    /* OK */
}
```

> A troca de tema (se um dia houver marca clara) acontece **aqui**, nunca nos primitivos.

## 3. Camada 3 — Tokens de componente (uso) — só editor

Mínimo necessário. Nem todo atributo vira token de componente.

```css
:root {
  --button-bg:      var(--ui-accent);
  --button-text:    var(--c-ink-900);      /* texto escuro sobre lime */
  --button-radius:  var(--radius-md);
  --input-bg:       var(--ui-bg-surface);
  --input-border:   var(--ui-border);
  --input-focus:    var(--ui-focus-ring);
  --panel-bg:       var(--ui-bg-surface);
  --toolbar-bg:     var(--ui-bg-app);
}
```

## 4. Tipografia

- **Headline / títulos:** JetBrains Mono (`--font-mono`) — assinatura hacker/técnica da Root.
- **Corpo:** Space Grotesk (`--font-grotesk`).
- **Escala:** sm / md / lg / xl / 2xl (ver primitivos). Fontes empacotadas localmente (local-first: não depender de CDN).

## 5. Identidade de marca e reskin (inegociável)

- **Cor primária (assinatura):** `#9BDB1F` (lime). Não muda entre peças da Root.
- **Acento:** `#FF1F6B` (magenta) — usado com parcimônia, para alerta/destaque, nunca como fundo de área grande.
- **Tom visual:** técnico/industrial escuro — terminal, monospace, alto contraste, "identidade hacker". Sem gradientes decorativos genéricos.
- **Reskin do Open Design (portão de aceite da Fase 1):** trocar **nome do app, logo, favicon/ícone, splash/tela inicial, textos visíveis (menus, tooltips, sobre), e metadados** (title da janela, manifest, about) para a identidade Root. Nada pode denunciar Open Design. O reskin fica isolado numa camada de tema/branding, separado do core do fork (sobreviver a updates upstream).
- **Voz/tom textual** (`brand.json voice_tone` + `rules`): "direto, técnico, sem 2ª pessoa". Palavras **proibidas** (`solução completa`, `disruptivo`, `2ª pessoa`, `alavancar`, `potencializar`) e **aprovadas** (`método`, `processo`, `operador`, `identidade`, `voz própria`, `camada antes do prompt`) valem para textos da UI do editor **e** para o conteúdo dos slides — aplicado na fase de criação (QA anti-slop das skills).
- **Motion:** micro-interações discretas (foco, hover, confirmação de export). Alto impacto em poucos momentos, não ruído.

## 6. Acessibilidade (embutida nos tokens)

- **Pares seguros (fundo escuro `#070A08`):** texto `#DFFFE8`, lime `#9BDB1F`, magenta `#FF1F6B` — todos alto contraste sobre o ink. Alvo WCAG AA.
- **Pares a evitar:** lime sobre mint, magenta sobre lime, texto claro sobre lime (baixo contraste). Ação primária = fundo lime + **texto escuro** (`--button-text: #070A08`), não texto claro.
- **Foco visível** (`--ui-focus-ring: #9BDB1F`) em todo elemento interativo.
- **Governança:** calcular e documentar o ratio exato de cada par texto/fundo antes de fechar a Fase 1 (não presumir — verificar).

## 7. Governança

- [ ] Tokens versionados junto do código; **gerados/derivados do `brand.json`** (fonte única — divergência é bug).
- [ ] Convenção de nomes consistente (`--ui-bg-app`, `--slide-headline` — nunca `--verde`).
- [ ] `--ui-*` (chrome) e `--slide-*` (conteúdo) nunca se cruzam.
- [ ] Auditoria por release: remover tokens órfãos.
- [ ] Mudança de token = decisão consciente (Camada 2 §7: o agente não muda tokens sozinho).
- [ ] Nenhum valor visual hard-coded na UI — verificável por busca (`grep '#'`).
