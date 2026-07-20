# Camada 3 — Arquitetura

> **v0.2 — Operação Root / Máquina de Carrossel V03.**
> Contexto fixo, junto com Camada 0 (fundamentos) e Camada 2 (constraints). Descreve **como o sistema se organiza** e **por que** — não o passo a passo de implementação (isso vem por fase do PRD).
>
> **Mudança 0.1 → 0.2 (pivot):** um produto só (o editor). A criação de texto deixou de ser um plugin externo e virou **skills/subagents de Claude Code executadas pelo Claude Code do cliente, spawnado headless pelo daemon do editor**. A fronteira "cérebro × mãos" **colapsou** em "fase de criação × fase de edição/render", com o `slides.json` como hand-off interno. Ver ADR-006.

---

## 1. Visão em camadas

Regra de dependência: as setas apontam **para dentro**. O núcleo não sabe que o editor é Open Design, que o agente de texto é o Claude Code do cliente, nem qual modelo de imagem existe.

```
        ┌─────────────────────────────────────────────────────────┐
        │  DRIVERS (o mundo externo, trocável)                     │
        │   • Claude Code do cliente (spawnado headless pelo       │
        │     daemon; executa as skills/subagents da Root)         │
        │   • Open Design (editor concreto, reskinnado)            │
        │   • Modelo de imagem (chave do cliente)                  │
        │   • VPS de licença (Root)                                │
        │   • Sistema de arquivos local (PNGs, persistência)      │
        └───────────────▲─────────────────────────────────────────┘
                        │ implementam portas
        ┌───────────────┴─────────────────────────────────────────┐
        │  ADAPTADORES (portas & gateways)                         │
        │   • Staging de skills + spawn do CLI de texto            │
        │   • Adapter slides.json ↔ documento do editor           │
        │   • Gateway de licença (fala com a VPS, cacheia)         │
        │   • Gateway de imagem (fala com a API do cliente)        │
        │   • Exportador (documento → PNG 1080×1350)              │
        └───────────────▲─────────────────────────────────────────┘
                        │ chamam
        ┌───────────────┴─────────────────────────────────────────┐
        │  CASOS DE USO (orquestração da aplicação)                │
        │   criar carrossel (skills) · importar slides.json ·      │
        │   editar slide · gerar imagem · reordenar · exportar ·   │
        │   validar licença                                        │
        └───────────────▲─────────────────────────────────────────┘
                        │ usam
        ┌───────────────┴─────────────────────────────────────────┐
        │  ENTIDADES (núcleo estável, sem tecnologia)              │
        │   Carrossel · Slide · contrato slides.json               │
        │   Regras de marca (tokens, palavras proibidas, capa/     │
        │   fechamento) · Licença (estado: ativa/expirada/cache)   │
        └─────────────────────────────────────────────────────────┘
```

**Criação × edição (um produto só):** a fase de criação (skills rodando no Claude Code do cliente) produz e a fase de edição/render (editor) consome — mas as duas só se conhecem pelo **contrato `slides.json`**. Nenhuma importa a estrutura interna da outra. As duas vivem **dentro do mesmo editor**; o `slides.json` é o hand-off interno, não mais uma fronteira entre dois produtos instaláveis.

---

## 2. Onde a IA entra

Dois pontos de IA, ambos com **fronteira determinística** ao redor:

1. **IA de texto (criação).** O **Claude Code do cliente**, spawnado headless pelo daemon do editor, roda o pipeline editorial (brief → triagem → 10 headlines → espinha → framework → copy → QA anti-slop) executando as **skills/subagents da Root encenadas no diretório de trabalho**. Saída: `slides.json`. **Cerca determinística:** validação de schema + regras de marca (tokens, palavras proibidas, 1 capa na ordem 1 + 1 fechamento por último) rodam como código, não como "confia no modelo".
2. **IA de imagem (edição).** Provider-agnóstico, chave do cliente, dentro do editor. **Cerca determinística:** o gateway de imagem valida entrada/saída e nunca deixa a chave ou o prompt sensível vazar em log.

Tudo que é regra de negócio — o que torna um carrossel "válido para a Root" — é código testável. O LLM propõe; o determinístico dispõe.

---

## 3. Fluxo de dados

```
[cliente no editor Root]
   │  descreve o tema
   ▼
DAEMON encena as skills/subagents da Root no diretório de trabalho
   │  e spawna o Claude Code DO CLIENTE (headless, tokens dele)
   ▼
CRIAÇÃO (pipeline editorial via skills) ──► slides.json ──(validado por schema)──►
   │
   ▼  (mesmo editor, sem trocar de janela)
EDIÇÃO (editor Open Design reskinnado)
   │  adapter: slides.json → documento do editor
   ▼
edição livre (texto, cor por token, troca/gera imagem, reordena)
   │           │
   │           └─► gateway de imagem ──► API do cliente (chave local)
   ▼
exportador ──► PNGs 1080×1350 no disco local (deviceScaleFactor explícito = 2,5714)
   │
   └─(em paralelo, no boot/abertura)─► gateway de licença ──► VPS (com cache offline)
```

Pontos-chave:
- `slides.json` cruza a fronteira criação→edição **uma vez**, validado — hand-off interno.
- A **auth/tokens do Claude Code**, a **chave de imagem** e o **conteúdo** não saem da máquina do cliente.
- A licença é o **único** tráfego cliente→Root, e é read-only (valida, não envia conteúdo).

---

## 4. ADRs (decisões arquiteturais)

### ADR-001 — Forkar/embutir o Open Design reskinnado, em vez de construir um editor do zero
- **Contexto:** o requisito virou "ferramenta pro de edição na mão do cliente" (editar livremente, não só aprovar).
- **Decisão:** forkar o Open Design (Apache-2.0), reskinnar com a cara da Root, manter fechado e distribuir.
- **Consequência:** ganho de tempo enorme vs. reconstruir um Canva; custo = manutenção do fork (mitigado isolando reskin + adapter + skills e fixando versão de upstream). **Reverte** a recomendação anterior ("evoluir a V02") — que valia quando o requisito era só "imagens mais bonitas".

### ADR-002 — Aposentar `render.mjs`/Playwright; exportação do editor é a única superfície de render
- **Contexto:** manter dois caminhos de render (Playwright + editor) duplica manutenção e diverge visual.
- **Decisão:** a exportação do editor substitui o `render.mjs`, com **`deviceScaleFactor` explícito** (alvo 1080/420 = 2,5714) para saída determinística entre máquinas. Antes de remover, testar **paridade visual** contra os PNGs 1080×1350 da V02.
- **Consequência:** uma superfície só; risco de regressão visual coberto por teste de paridade. **Provado no Spike 3** (paridade de pixel; o `capture-spike.mjs` demonstrou o DSF explícito via `Emulation.setDeviceMetricsOverride`). Falta o wiring de produção no `deck-capture` do desktop (hoje usa `clip.scale:1` + DPR do display → não-determinístico).

### ADR-003 — `slides.json` como contrato versionado (hand-off interno criação↔edição)
- **Decisão:** a fase de criação (skills) e a de edição/render (editor) se comunicam exclusivamente pelo `slides.json` (schema versionado, retrocompatível dentro de major).
- **Consequência:** as duas fases evoluem independentes; trocar a mecânica de criação (skills) não quebra o editor (e vice-versa). Vinha do desenho "duas metades"; **sobrevive ao pivot** como fronteira interna do produto único.

### ADR-004 — Licença via chave validada na VPS (phone-home) + cache offline, sem DRM pesado
- **Contexto:** o código roda no disco do cliente, público técnico. Senha local pura não revela **quem usa nem se pagou**, e é removível.
- **Decisão:** chave validada contra a VPS (ativação/revogação/telemetria), com cache offline de N dias; segredo de assinatura só na VPS. Sem anti-tamper pesado (ROI negativo contra público técnico).
- **Consequência:** dá para responder "quem usa e pagou"; o moat real é **valor recorrente** (updates, frameworks, método, suporte) gated na licença ativa — não a proteção do binário.

### ADR-005 — A chave de imagem é do cliente, configurada no editor; a Root não intermedia
- **Decisão:** geração de imagem usa a chave do próprio cliente, conectada dentro do editor. A Root não hospeda nem paga.
- **Consequência:** custo de inferência de imagem sai da Root; a chave nunca trafega para a Root (implica regras de log/telemetria da Camada 2 §3–4).

### ADR-006 — Metodologia embutida no editor como skills de Claude Code, executadas pelo Claude Code do cliente (o pivot) — supersede o desenho de "plugin separado"
- **Contexto:** o desenho original tinha **duas metades para instalar e costurar**: um plugin de Claude Code (cérebro) + o editor (mãos). A inspeção do fork mostrou que o daemon do Open Design **já spawna o CLI de código local do cliente** (`claude -p --input-format stream-json --output-format stream-json … --permission-mode bypassPermissions`, prompt via stdin, retoma a própria sessão entre turnos) e **encena skills `SKILL.md` no diretório de trabalho**. O `@anthropic-ai/sdk` presente em `apps/web` é só um chat BYOK de browser (sem ferramentas/skills) — **não** o motor.
- **Decisão:** colapsar as duas metades num produto só. A metodologia da V02 é **reempacotada como skills + subagents de Claude Code**, versionada no repo da Root, **encenada no diretório de trabalho** e executada pelo **Claude Code do cliente spawnado pelo daemon**. Sem plugin instalado à parte; sem SDK; sem serviço hospedado. O `slides.json` vira hand-off interno (ADR-003).
- **Consequência:** mata o setup do plugin (o atrito que motivou o pivot) e unifica em uma ferramenta. Custo real = acoplamento às convenções de **staging/runtime-def** do fork + merge de upstream + reskin — **não** um framework de agente proprietário ("empacotar skills", não "reescrever o pipeline"). Nova superfície de segurança: o CLI roda com `--permission-mode bypassPermissions` → a contenção é por **diretório de trabalho + `--add-dir` mínimo** (Camada 6, LLM06). A audiência "quem usa Claude Code" continua premissa (o cliente precisa ter o Claude Code instalado). A inferência de texto segue paga pelo cliente (a economia do pivot é setup/UX, **não** token).

---

## 5. Fronteiras de confiança / segurança

Alinha com a Camada 6 (OWASP-LLM) e com os fundamentos:

- **Entrada externa é dado, não comando (LLM01).** Tema, briefing e qualquer conteúdo trazido da web entram no pipeline como *dados*. Instruções embutidas neles não viram ação.
- **Agência do CLI spawnado (LLM06).** O Claude Code roda com `bypassPermissions`; a contenção vem de manter o diretório de trabalho e o `--add-dir` restritos ao projeto — nunca o disco inteiro. O `.mcp.json` auto-carregado do cwd é parte da superfície (só MCPs da Root/confiáveis no diretório).
- **Auth, chave e conteúdo do cliente ficam locais (LLM02 — vazamento).** A fronteira de log/telemetria redige segredos na borda; identificador entra no log, o dado não. Nunca logar auth/tokens do Claude Code do cliente.
- **Validação de licença sobre a rede:** não confiar em claims do cliente; a VPS **assina** a resposta; nunca expor o segredo de assinatura no binário. Falha de rede cai no cache — não em "liberado geral".
- **Exportação escreve arquivos locais:** caminhos controlados, sem sobrescrever fora do diretório de saída.
- **Reskin e skills isolados do core:** as camadas de branding e de skills/staging não abrem superfície nova de ataque nem dependem de estrutura interna volátil do upstream.

---

## 6. Decisões adiadas

- **Provider de imagem "padrão" sugerido** ao cliente (ex.: Gemini 2.5 Flash Image): decidir na Fase 2, junto do gateway de imagem.
- **Mecânica de distribuição** (como o cliente baixa/instala o editor e ativa a licença): detalhar na Fase 4 (licença + distribuição).
- **Como a UI do editor dispara a criação** (a superfície que aciona o spawn do Claude Code + staging das skills): detalhar na Fase 3, respeitando as convenções do fork (não reimplementar a orquestração).
- **Vídeo (Palmier):** fora de escopo na V03 — fechada/paga, Swift/macOS-only, IA de vídeo fechada. Aposta separada e posterior.

> **Resolvido no pivot (era decisão adiada na v0.1):** o framework interno de UI e o modelo de execução do agente do Open Design — **React (`apps/web`) + daemon Node/TS (`apps/daemon`) + Electron (`apps/desktop`)**; o agente de texto é o **CLI local do cliente spawnado pelo daemon**, com skills encenadas no diretório de trabalho. Não presumir além disso sem reler o fork.
