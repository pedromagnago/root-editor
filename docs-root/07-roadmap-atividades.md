# Roadmap de Atividades — Máquina de Carrossel V03 (Operação Root)

> Lista executável de **todas as atividades de todas as fases**. Companheiro do `01-prd.md`:
> o PRD conta o "o quê e o porquê"; este doc quebra cada item em **tarefa concreta e verificável**.
> **Versão:** 0.1 · **Data:** 01/07/2026 · **Status:** vivo (atualizar o status a cada sessão)

## Como usar
- Entregar ao agente de código **uma fase por vez** (contexto fixo: Camadas 0 + 02 + 03 + a fase da vez).
- Marcar o status na origem. Um `- [x]` só entra quando a tarefa está **provada** (rodou / passou teste), não "escrita".
- Legenda de status (sem emoji, para bater com o padrão do Pedro):
  - `- [x]` concluído e provado
  - `- [ ]` a fazer
  - **(parcial)** — começado/provado em spike, falta promover a produção
  - **(verificar na base)** — o Open Design talvez já entregue; confirmar antes de construir
  - **(bloqueado: …)** — depende de decisão/insumo do Pedro

---

## Estado atual (09/07/2026)
Fork em `~/dev/root-editor` (fora do Drive), Node 24 isolado, repo privado `pedromagnago/root-editor`. **Fase 1 tecnicamente completa** (1.B reskin ✓, 1.C import ✓, 1.D paridade ✓, 1.E edição ✓, 1.F export ✓, 1.G estados/logging ✓) e **Fase 3 embutida** (skill `carrossel-root` + auto-render + fluxo "Novo carrossel"). Falta só o que depende do Pedro: dogfooding 1.H e validações visuais.

- **09/07/2026 — multi-marca (motor do "brand pack por cliente" da Fase 4):** o render agora honra o `brand_pack_ref` do `slides.json` — `carousel-brand.ts` porta o `deriveTokens`/`rootCss` da V02 (oklab sem dependência nova) e compõe `base.css` + tokens da marca + `skin.css` de `~/.maquina-carrossel/marcas/<slug>/`, com pack Root empacotado como default e teste-âncora provando que compor o pack Root reproduz **byte a byte** o `base-skin.root.css` da paridade de pixel. Rotas novas (`GET /api/carousel/brands`, `PUT /api/carousel/brands/active`, `marca` no import) + seletor de marca no card "Novo carrossel" (troca a marca ativa que a skill lê — semântica do `/marca` da V02). Refs hostis (fora da raiz de marcas) são descartadas com fallback Root.
- **09/07/2026 — ícones binários do app:** gerados programaticamente do wordmark (R lime + cursor magenta + grid terminal em ink, JetBrains Mono 800) e trocados em `tools/pack/resources/{mac/icon.icns,mac/icon.png,win/icon.ico,linux/icon.png}`. Pedro valida o visual no próximo build empacotado.

---

## Bloco 0 — Pendências imediatas (fechar antes de seguir)
- [x] **Verificar o export "Baixar slides" ponta-a-ponta** — *(01/07/2026)* provado via API real do daemon (projeto "Root — Pronampe 2026"): `POST /export/slides` → zip com 6 PNGs **exatamente 1080×1350** e **2160×2700**; pixel-diff contra os PNGs da V02 deu 0,05%–1,10% de pixels perceptíveis (MAE ≤ 3,74/255 — só anti-aliasing). *(Falta só o clique visual no botão/modal da UI, que é typechecked; Pedro pode conferir no uso.)*
- [x] **Repo próprio da Root criado e push feito** *(01/07/2026)*: `https://github.com/pedromagnago/root-editor` (**privado**). `origin` → repo da Root; `upstream` → `nexu-io/open-design` (pra merges futuros). O clone raso do fork quebrava o push (`.git/shallow` → pack com pai inexistente); resolvido **re-raizando a história**: commit-raiz `391b991` "vendor snapshot of nexu-io/open-design @ 56d51b8" (árvore idêntica, sem história do fornecedor) + os commits da Root re-aplicados. **SHAs novos:** export = `cc7cb3b`, gitignore = `9bede1f`, import carrossel = `f0c6aa8`.
- [x] **`.gitignore` do spike** — `root/` ignorado (commit `4973a3d`).

---

## Fase 1 — Editor visual próprio (Open Design reskin) alimentado por `slides.json` · MVP
**Objetivo:** `slides.json` da V02 → editor local estilo Canva com a cara da Root → edição básica → PNGs. Prova o espinhaço (embed + reskin + ingestão + export) antes de qualquer IA, gating ou distribuição. **Local, só Root (dogfooding).**

### 1.A — Fundação do fork
- [x] Forkar/embutir o Open Design (Apache-2.0) rodando local (`~/dev/root-editor`, Node 24, daemon + web).
- [x] Atribuição Apache-2.0 presente e preservada: `LICENSE` (Apache-2.0) na raiz + `"license": "Apache-2.0"` no `package.json`; não há `NOTICE` no upstream (nada extra a manter). Regra: **não remover** o LICENSE no reskin; atribuição some da UI, não do código-fonte.
- [x] Commit-base do upstream registrado: **`56d51b8`** ("[codex] Handle AMR stderr balance retries (#5015)", `origin/main` = `nexu-io/open-design`). Todo trabalho da Root são commits em cima dele — merge futuro é diff controlado contra esse ponto.

### 1.B — Reskin "cara da Root" (inegociável) — **FEITO** *(01/07/2026, commit `fcfa151`, 139 arquivos)*
- [x] **Camada de tema isolada** `apps/web/src/styles/root-theme.css` (importada por último — sobrevive a merge do upstream): primitivos do `brand.json` + semânticos `--ui-*`; o chrome do fork usa tokens próprios (`--bg/--accent/--selected` etc.), sobrescritos pela camada; `--slide-*` (conteúdo) segue vivendo só no CSS do deck — as duas superfícies não se cruzam.
- [x] Paleta Root aplicada (lime `#9BDB1F` sobre ink `#070A08`, magenta `#FF1F6B`), **tema escuro como default de fábrica** (o accent do fork é aplicado por inline-style num script pré-hidratação — trocado nos 3 pontos: `appearance.ts`, `layout.tsx`, `config.ts`).
- [x] **Contraste AA em escala:** `--accent-contrast` derivado por **luminância** do accent em runtime (limiar 0,1855 = crossover matemático tinta-escura/branca) — lime → texto `#070A08` (11,9:1), e os 8 swatches de accent do seletor do usuário todos ≥ AA; ~40 regras do core com branco hardcoded sobre accent re-apontadas pra var (incluindo o botão de enviar do chat).
- [x] Tipografia do chrome: JetBrains Mono (títulos) + Space Grotesk (corpo), **7 woff2 empacotados localmente** (extraídos do CSS provado da V02 — sem CDN).
- [x] Identidade trocada: título "Root Editor", favicon/logo SVG novos, wordmark ROOT na home, splash web e **splash do desktop** (o vídeo WebM do fornecedor com wordmark, 309KB base64, virou SVG estático da Root com o mesmo contrato de timing), © e about, productName/appId `com.operacaoroot.rooteditor`, instaladores mac/win/linux, lanes de release, menu Help → repo da Root.
- [x] Agente cloud do fornecedor ('amr') exibido como **"AMR"** (neutro) em 8 superfícies.
- [x] i18n: 19 locales + 17 content-locales rebrandados **só nos values** (multiset de chaves conferido: zero chave alterada); chaves mortas com handles do fornecedor também limpas (risco latente).
- [x] Strings que entram em **prompt** (marcadores de truncamento, context warning, sentinela do design-system workspace) rebrandadas; o detector da sentinela aceita o prefixo legado (sessões antigas continuam mascaradas).
- [x] Varredura anti-vazamento em 3 rodadas de auditoria adversarial ("Open Design", "OpenDesign", assets visuais): nada visível resta. **Internos aceitáveis mantidos** (nunca renderizam): pacotes `@open-design/*`, localStorage `open-design:config`, prefixos `od:`/`OD_*`, IPC, APIs `window.openDesignDesktop`.
- [x] *(follow-up de asset)* Ícones binários do app (.icns/.ico/.png de dock/taskbar/linux) trocados *(09/07/2026)* — gerados programaticamente do wordmark (R lime + cursor magenta, grid terminal, JetBrains Mono 800 rasterizada via Chromium) nos 4 resources de `tools/pack/resources/`. **Pedro aprova o visual** no próximo `tools-pack mac build` (fonte: `icon.html` no scratchpad da sessão de 09/07; regenerável).
- [ ] *(fora de escopo registrado)* `apps/landing-page/` cita Open Design no conteúdo editorial — só importa se a landing for publicada como Root.

### 1.C — Ingestão do `slides.json` (adapter → produção)
- [x] **Adapter em produção** *(01/07/2026, commit `a820e93`)*: módulo `apps/daemon/src/carousel-import.ts` + rota `POST /api/import/carousel`. Recebe a pasta da peça (contém `slides.json`), valida, gera `deck.html` com o CSS provado e **materializa** o projeto em `PROJECTS_DIR` — a pasta de origem nunca é escrita. Botão "Importar carrossel (slides.json)" no painel de novo projeto (picker nativo), i18n nos 19 locales. Testes de rota: 5/5.
- [x] Todos os 7 componentes do contrato renderizados (`data-pill`, `strike-pill`, `insight-box`, `feature-list`, `numbered-steps`, `table`, `cta-button`) + imagem local embutida em base64 (ref fora da pasta é recusada) + escaping com só `<strong>`/`<em>` passando.
- [x] Ler a saída real da V02 direto de `~/.maquina-carrossel/saidas/…` — provado com a peça pronampe-2026 real.
- [x] Validar o `slides.json` contra o schema da V02 na entrada — campos + regras estruturais (1 capa na ordem 1, 1 fechamento por último, ordem sequencial, cta só no fechamento); erro lista todos os problemas.
- [ ] *(follow-up, Fase 4)* No app desktop empacotado, o import precisa do fluxo de token do picker nativo (hoje o botão usa o picker do daemon — funciona no dev/web; o gate de token é honrado, mas o host desktop ainda não emite token pra essa rota).
- [ ] *(nota 1.E)* "Mapear campos para objetos editáveis" na UI — o deck importado é HTML renderizado; a edição estruturada (texto/cor/reordenar) é o trabalho do 1.E.

### 1.D — Renderização fiel (dentro do editor)
- [x] O slide renderizado bate com o PNG da V02 **pelo caminho de produção** *(01/07/2026)*: peça real → `POST /api/import/carousel` → deck materializado → `POST /export/slides` → pixel-diff vs V02: 0,03%–1,10% de pixels perceptíveis (MAE ≤ 3,74/255 — anti-aliasing), 6/6 slides exatamente 1080×1350.
- [x] `base-skin.root.css` reusado como camada de render (agora mora em `apps/daemon/assets/carousel/`, lido pelo módulo de import).

### 1.E — Edição
**Arquitetura decidida (01/07/2026):** o `slides.json` é a fonte de verdade — o painel edita o contrato, o daemon valida e **re-renderiza o `deck.html` pelo mesmo pipeline do import** (paridade por construção; o preview atualiza sozinho via chokidar→SSE). Trilho pronto pra Fase 3.
- [x] **Daemon** *(01/07/2026, testes 10/10)*: `GET /api/projects/:id/carousel` (working copy editável) + `PUT` (valida contrato → grava `slides.json` → re-render `deck.html`; 400 lista os problemas; ref de imagem que escapa do projeto é recusada). Import agora é **auto-contido**: imagens copiadas pra `assets/` do projeto com refs reescritas — edições re-renderizam mesmo se a pasta de origem sumir.
- [x] **Painel web** *(02/07/2026, commit `dc5025d`)*: dock lateral ao lado do preview do deck, gateado por `artifactManifest.metadata.source==='carousel'` (sem prop nova) — lista de slides ordenada (clique navega o preview via bridge `od:slide` com índice), campos por tipo (capa/conteudo/fechamento), **`bg` restrito aos 4 tokens do contrato** (cor por token ✓), reordenar ↑/↓ só nos slides do meio (capa/fechamento travados com tooltip), adicionar/remover respeitando 4–10, save explícito com **dirty semântico** (compara o documento normalizado — digitar e apagar volta a "sem mudanças"), 400 do contrato lista os problemas sem perder a edição, refetch silencioso em mudança externa só quando não-dirty, `<strong>`/`<em>` permitidos (resto escapado pelo daemon). 41 chaves i18n nos 19 locales. Dock de carrossel e de comentários mutuamente exclusivos. Verificado: web typecheck+build, 204/204 suítes do FileViewer, revisão de código (2 finders + passada manual nos pontos críticos — índice do bridge, shapes das rotas, regras estruturais).
- [ ] *(depois do MVP)* Edição de `componentes` (data-pill, table etc.) — dados preservados intactos no MVP, badge indica presença.
- [ ] *(follow-ups de eficiência registrados na revisão, não bloqueiam)*: memoizar data-URIs de imagem por mtime no re-render do PUT; pular o refetch pós-save auto-originado; consolidar os efeitos de reset de dock no FileViewer.
- [ ] **Contact sheet / grid:** a lista de slides do painel + navegação do deck cobrem o essencial; grid visual de thumbnails fica como melhoria.
- [ ] **Falta validar no olho (Pedro):** abrir um projeto de carrossel, clicar no botão do painel na toolbar do deck, editar/salvar e ver o preview atualizar.

### 1.F — Export determinístico e aposentar o `render.mjs`
- [x] Export dos PNGs a partir do estado editado, com **`deviceScaleFactor` explícito** (via `targetWidth` → `Emulation.setDeviceMetricsOverride` no deck-capture). Saída determinística entre máquinas.
- [x] Resoluções: **1080×1350** (Instagram, padrão) e **2160×2700** (2× retina), com modal de escolha.
- [x] Formato "slides": `.zip` com N PNGs separados (um por slide), além dos exports existentes (PDF/imagem/PPTX intactos).
- [x] **Teste de paridade de produção (caminho real, sem edição):** *(01/07/2026)* export via daemon+sidecar do deck pronampe vs PNGs da V02 → 0,05%–1,10% pixels perceptíveis, MAE ≤ 3,74/255 (anti-aliasing). Melhor que o harness do Spike 3 (slide 5: 3,26% → 1,10%).
- [x] **Teste de paridade com estado EDITADO** *(01/07/2026)*: import → `PUT /carousel` (headline editada, bg→alert, bloco reescrito, slides 4↔5 trocados) → re-render → export 1080 vs **oráculo** (`render.mjs` da V02 rodando o MESMO `slides.json` editado) → **0,00%–0,67%** pixels perceptíveis, MAE ≤ 2,45/255. A paridade vale para conteúdo arbitrário, não só a peça original.
- [ ] **Aposentar o `render.mjs`/Playwright da V02** — a partir da V03 o editor é a única superfície de render+edição.

### 1.G — Fundamentos por tela (Camada 0) — **FEITO** *(02/07/2026, commit `e206f39`)*
- [x] Persistência local: coberta pela base + nosso fluxo (projeto materializado em disco; abrir/salvar/reabrir provado nos testes de rota e no smoke).
- [x] Os **4 estados** nas telas do fluxo de carrossel — auditado: import (importando/erro-toast/sucesso), painel de edição (carregando/erro+retry/sucesso; vazio não ocorre por gate), export (modal + toasts do fluxo existente). Preview atualiza via SSE.
- [x] **Logging estruturado com `trace_id`**: `apps/daemon/src/logging/carousel.ts` (padrão da casa: 1 JSON/linha, namespace `carousel`) — `import_succeeded/rejected`, `edit_succeeded/rejected`, `export_succeeded/failed`, com traceId, duração e contagens; `projectId` une a jornada. Provado vivo no smoke: as 3 pontas logando.
- [x] Itens **[F1]** da Camada 6 aplicáveis à Fase 1 — auditados: `slides.json` validado por schema antes do render ✓; texto sanitizado (só `<strong>`/`<em>`) ✓; refs de imagem confinadas ao projeto ✓; upstream fixado (snapshot `391b991`) + lockfile ✓; **logs sem conteúdo/segredo** ✓. Itens [F1] de staging de skills/`.mcp.json`/`--add-dir` valem quando a Fase 3 criar essas superfícies (registrados lá).

### 1.H — Aceite da fase (dogfooding)
- [ ] Rodar **ponta a ponta na máquina da Root** consumindo uma saída real da V02: importar `slides.json` → editar → exportar PNGs 1080×1350 — sem tocar em código.
- [ ] Cronometrar "tema → carrossel exportado" (meta do PRD: < 15 min).

---

## Fase 2 — IA visual: gerar e trocar imagem no editor
**Objetivo:** trazer "gera/troca imagem" pra dentro do editor, com modelo texto→imagem provider-agnóstico. Chave de imagem é **do cliente**.
- [ ] Trocar imagem de um slide por **upload de arquivo local**.
- [ ] **Gerar imagem por prompt** (texto→imagem), provider-agnóstico, com o resultado caindo no slide selecionado.
- [ ] **Revisão humana obrigatória:** nenhuma imagem gerada entra sem o cliente aceitar.
- [ ] **Conexão da chave do cliente** dentro do editor (a Root não hospeda nem paga; a chave nunca vai pro servidor da Root).
- [ ] Instrumentar a chamada ao modelo de imagem: latência, custo/uso, sucesso/erro.
- [ ] Tratar falha/timeout do provider com os 4 estados e retry explícito.

---

## Fase 3 — Metodologia embutida: criação por IA dentro do editor
**Objetivo:** fechar "tema → carrossel" **sem sair do editor e sem plugin à parte** — o editor spawna o Claude Code do cliente e roda o pipeline da V02 como skills/subagents.
- [x] **Pipeline portado como skill embutida** *(02/07/2026, commit `7ca4181`)*: `skills/carrossel-root/` no repo (SKILL.md `mode: deck` + `knowledge/` e `schemas/` verbatim da V02). Única mudança cirúrgica: o passo final **escreve o `slides.json` na raiz do projeto e para** — o editor assume (mesmo pipeline do import/PUT). Imagens vão pra `assets/` do projeto (auto-contido). **Pedro revisa o conteúdo do método quando quiser** — é o texto da V02 intacto.
- [x] **Auto-render no daemon** *(02/07/2026, commit `c0039d7`)*: serviço `carousel-autorender.ts` vigia projetos de carrossel e re-renderiza `deck.html` a cada mudança do `slides.json` (mesmo pipeline do import/PUT). Compartilha o chokidar da SSE (keyed por dir, sem descritor extra); renders serializados por projeto (burst não perde estado); só `slides.json` dispara, escrever `deck.html` não re-dispara (sem loop); primeira escrita de projeto do chat materializa manifest+metadata+tab. **Provado vivo**: agente escreve `slides.json` no disco → deck re-renderiza em ~400ms, sem rota.
- [x] **Fluxo "Novo carrossel"** *(02/07/2026, commit `e0b10e9`)*: `POST /api/projects/carousel` cria projeto com skill `carrossel-root` + `carousel:true` + `pendingPrompt=tema`; botão na UI (App→EntryView→EntryShell→NewProjectModal→NewProjectPanel), i18n 19 locales, auto-send do tema. **Staging validado vivo**: `stageActiveSkill` copia a árvore inteira (SKILL.md + 6 knowledge + 2 schemas) pra `.od-skills/carrossel-root/` no cwd.
- [x] A criação **continua a mesma sessão** do agente entre turnos (`--resume`) — o fork já faz.
- [x] Validação do `slides.json` contra o schema no hand-off — `parseCarouselSlides` guarda import, PUT e auto-render.
- [x] **Contrato versionado** *(02/07/2026, commit `658c3a8`)*: campo `versao` opcional (`CAROUSEL_CONTRACT_VERSION=1`); ausente = atual, mais novo que o build = recusa clara, todo deck parseado é carimbado. Compat N/N-1.
- [x] Superfície de criação: ChatPane do fork mostra o progresso do agente (herda os 4 estados do fork); revisão fina no dogfooding.
- [ ] **Teste ponta-a-ponta com agente REAL** = o **dogfooding do Pedro (1.H)**: tema no chat → Claude Code dele roda a pipeline → `slides.json` → auto-render → deck no painel → export. Todos os elos provados isoladamente (staging, endpoint, auto-render, painel, export); só falta a passada com o CLI real (tokens do Pedro).

---

## Fase 4 — Gating por licença + distribuição ao cliente
**Objetivo:** distribuição do editor, chave que libera acesso, e expansão além da Root.
- [ ] **Gate por licença — chave validada contra a VPS** (ativação/revogação/telemetria de quem usa e pagou), com **cache offline** de alguns dias. Reaproveita padrão HMAC do `tools.fullbpo.com`.
- [ ] Endpoint de licença na VPS (ativar/revogar/heartbeat) + tela de ativação no editor.
- [ ] **Empacotar e distribuir** o editor Root (instalável desktop; Claude Code é pré-requisito que o cliente já tem).
- [ ] **Brand pack por cliente** (cada cliente com seu `brand.json`; multi-marca).
- [ ] Fluxo de update gated na licença ativa (o moat real: método/updates/suporte atrás da chave).

---

## Fase 5 — Robustez, multicliente e portão de segurança
**Objetivo:** endurecer para uso real por vários clientes.
- [ ] **Observabilidade completa** (Camada 0): log estruturado JSON, níveis, `trace_id` ponta a ponta, métricas de uso/custo.
- [ ] **Limites de uso/custo** (guardas contra abuso e custo descontrolado).
- [ ] **Portão OWASP-LLM completo** (Camada 6) antes da distribuição ampla — atenção especial ao `--permission-mode bypassPermissions` do CLI spawnado (LLM06): sandbox por diretório + `--add-dir` mínimo, sem disco inteiro.
- [ ] **Documentação de onboarding** do cliente.
- [ ] Teste de fork-merge: atualizar o upstream do Open Design e validar que o reskin/adapter sobrevivem (risco nº 1).

---

## Ordem de execução (v2 — aprovada por Pedro em 02/07/2026)
> Bloco 0, 1.A–1.F concluídos. A ordem nova **inverte Fase 2 e Fase 3** em relação ao PRD: sem a criação pelo chat (Fase 3) o dogfooding completo "tema → carrossel" não existe; IA de imagem é aditivo.

1. **1.G** — 4 estados no fluxo de carrossel + logging estruturado com `trace_id` + itens [F1] da Camada 6. *(Claude, solo)*
2. **Fase 3 — metodologia embutida** (o coração do produto): portar pipeline V02 → skills/subagents no repo; staging no cwd + spawn do Claude Code do cliente; validação do `slides.json` na saída + hand-off pro painel; superfície de criação na UI. *(Claude no trilho técnico; Pedro revisa o CONTEÚDO do método.)*
3. **1.H — dogfooding cronometrado** (Pedro na mão, Claude de copiloto; meta <15 min) → aposentadoria formal do `render.mjs` = **aceite da Fase 1**.
4. **Fase 2 — IA de imagem**: upload local, geração provider-agnóstico com aceite obrigatório, chave do cliente, instrumentação. *(Claude; chave de teste do Pedro.)*
5. **Fase 4 técnica** — licença na VPS (confirmar antes de mexer na infra), tela de ativação, empacotamento. *(Decisões de negócio + Apple Developer = Pedro.)*
6. **Fase 5** — robustez/segurança/docs + teste de merge do upstream.

### Depende só do Pedro (pode acontecer a qualquer momento)
- [ ] Validação visual do painel de edição (5 min, http://127.0.0.1:56236 → "Pronampe EDIT TEST").
- [ ] 1.H dogfooding cronometrado.
- [ ] Aprovar visual do ícone do app (Claude gera programaticamente do wordmark).
- [ ] Decisões Fase 4: preço, modelo de licença, primeiros clientes; conta Apple Developer.
- [ ] Limite mensal de gastos do Claude (claude.ai/settings/usage) — execuções multi-agente degradadas até subir.

---

## Notas técnicas (contexto fixo pro agente de código)
- **Geometria de render:** slide autorado **420×525**; alvo Instagram **1080×1350**; DSF explícito = alvo/autorado = **1080/420 = 2,5714**. O `targetWidth` do contrato deriva o DSF (`targetWidth / largura_autorada`); `deviceScaleFactor` explícito ganha se ambos vierem.
- **Cadeia do export "slides":** `FileViewer.tsx` → `exportProjectSlidesZip` (`exports.ts`) → `POST /api/projects/:id/export/slides` → `handleScreenshotExport(...,'slides')` (`import-export-routes.ts`) → `buildDeckRenderInput` (`deck-export.ts`) → IPC sidecar → `renderDeckSlides` (`deck-capture.ts`) → PNGs por slide → `buildSlidesZip` → `application/zip`.
- **Fork:** `apps/web` = React · `apps/daemon` = Node/TS (spawna o CLI) · `apps/desktop` = Electron (captura/export). Build: proto → desktop → daemon → web.
- **Fonte canônica de marca:** `~/.maquina-carrossel/marcas/root/brand.json` (Camada 4 espelha os tokens).
- **Runtime do agente (Fase 3):** o fork spawna o CLI real do cliente: `claude -p --input-format stream-json --output-format stream-json --verbose --permission-mode bypassPermissions` (prompt via stdin), auto-carrega `.mcp.json` do cwd e encena a skill ativa em `.od-skills/`.
