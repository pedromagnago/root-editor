# Camada 2 — Constraints (regras rígidas para o agente de código)

> **v0.2 — Operação Root / Máquina de Carrossel V03.**
> Este documento é **contexto fixo**: viaja junto com a Camada 0 (fundamentos) e a Camada 3 (arquitetura) em toda tarefa de código. São regras não-negociáveis. Quando uma tarefa exigir violar uma regra daqui, **pare e pergunte** — não decida sozinho.
>
> **Mudança 0.1 → 0.2 (pivot):** um produto só (o editor), com a metodologia embutida como **skills/subagents de Claude Code** executadas pelo **Claude Code do cliente spawnado headless pelo editor** — não um plugin instalado à parte. A stack do editor foi **confirmada por inspeção** (não é mais "a confirmar" — ver §1).

---

## 1. Stack (fixa)

### O editor (produto único)
- **Base:** fork/embed do **Open Design** (Apache-2.0). Confirmado por inspeção do fork:
  - **`apps/daemon`** — Node.js / TypeScript. É quem **spawna o CLI de código local do cliente** (Claude Code e outros) em modo headless e traduz o stream dele em eventos de UI. Auto-carrega `.mcp.json` do diretório de trabalho.
  - **`apps/web`** — UI em **React** (o chrome do editor; é aqui que mora o reskin).
  - **`apps/desktop`** — shell **Electron** (runtime desktop local-first; superfície de export/captura).
- **Runtime:** **Node.js** (o fork roda com Node 24 isolado no ambiente de dev da Root; Node global do Mac é 22 — não confundir). TypeScript.
- **Execução:** local-first, 100% na máquina do cliente.

### Criação de texto (o "cérebro" — embutido, não é plugin)
- **Formato:** **skills + subagents de Claude Code** (o mesmo primitivo `SKILL.md` da V02), versionados no repositório da Root. O editor os **encena no diretório de trabalho** (padrão de staging do fork) e o **Claude Code do cliente** — spawnado headless pelo daemon — os executa.
- **Contrato de saída:** `slides.json` validado contra `slides.schema.json` (versionado).
- **Inferência de texto:** Claude, no **Claude Code do cliente** (auth/assinatura/tokens dele). A Root não hospeda nem paga essa inferência.
- **Não reescrever o pipeline contra um SDK.** A metodologia é "empacotar skills", não "reimplementar contra `@anthropic-ai/sdk`". (O `@anthropic-ai/sdk` que existe em `apps/web` é só um chat BYOK de browser, **não** o motor de criação — não usar como base do cérebro.)

### IA de imagem
- Provider-agnóstico, **chave do cliente**, configurada por ele dentro do editor.

### Backend Root (mínimo)
- **Único serviço server-side da Root:** endpoint de licença na VPS (`31.97.21.167`, easyPanel + Docker Swarm + Traefik). Reaproveita o padrão HMAC do `tools.fullbpo.com`.
- Nenhum outro dado do cliente trafega para a Root.

### Proibições de stack
- **Não adicionar dependência nova** sem aprovação. Preferir o que o Open Design já traz.
- **Não introduzir Playwright** em nenhum caminho novo. O `render.mjs` da V02 está **aposentado** (ver §3).
- **Não trocar a stack interna do Open Design** (build, framework, bundler). Fork ≠ reescrita.
- **Não reimplementar a orquestração do agente.** A execução da IA de texto é o CLI local spawnado pelo daemon do fork — não construir um runner próprio nem chamar o Anthropic SDK direto.

---

## 2. Arquitetura (resumo — detalhe na Camada 3)

Regra de dependência (Clean Architecture): as dependências apontam **para dentro**. O núcleo é o **carrossel + regras de marca + contrato `slides.json`** — estável e ignorante de tecnologia. São **drivers plugáveis** (trocáveis sem tocar no núcleo): o editor Open Design, o **Claude Code do cliente** (spawnado pelo daemon; executa as skills), o modelo de imagem (chave do cliente) e o gateway de licença.

Teste da seta: se trocar o editor, o CLI de código, o modelo de imagem ou a origem da licença **quebrar** as regras do carrossel, a dependência está invertida — corrija.

---

## 3. Regras inegociáveis do projeto

1. **Reskin total (inegociável).** Nada na UI pode denunciar que é Open Design: nome, logo, ícones, splash, textos visíveis e metadados (title, manifest, about) viram identidade da Root. O reskin fica **isolado** numa camada própria (tema/branding), separada do core do fork, para sobreviver a atualizações upstream.
2. **`slides.json` é contrato versionado.** Toda mudança de schema é versionada e retrocompatível dentro de uma major. A **fase de criação** (skills) e a **fase de edição/render** (editor) só se falam por esse contrato — nunca por estruturas internas uma da outra.
3. **A chave de imagem do cliente nunca trafega para a Root.** Fica no ambiente local do editor. Não logar, não enviar, não intermediar. (Idem a auth/tokens do Claude Code do cliente.)
4. **Licença validada contra a VPS com cache offline.** Falha de rede **não bloqueia** a edição dentro da janela de cache (N dias). O segredo de assinatura da licença mora **só na VPS** — nunca no binário distribuído ao cliente.
5. **`render.mjs`/Playwright descontinuado.** A exportação do editor é a única superfície de render a partir da V03, com **`deviceScaleFactor` explícito** (alvo 1080/420 = 2,5714) para saída determinística. Antes de remover o caminho antigo, **testar paridade visual** contra os PNGs 1080×1350 da V02.
6. **Atribuição Apache-2.0 preservada.** LICENSE/NOTICE e cabeçalhos de copyright do Open Design permanecem no código-fonte. (Reskin de UI é permitido pela licença; remover atribuição de fonte não é.)
7. **Fronteira determinística.** O que é regra de negócio (validação de `slides.json`, tokens de marca, palavras proibidas, lógica de licença) é **código determinístico e testável** — não fica a cargo do LLM.
8. **Sandbox do agente por diretório de trabalho.** O CLI de texto roda com `--permission-mode bypassPermissions`; a contenção vem de **manter o diretório de trabalho e o `--add-dir` no mínimo** (só o projeto), nunca o disco inteiro. Ver Camada 6, LLM06.

---

## 4. Logging

Segue `docs/00-fundamentos/OBSERVABILIDADE-E-LOGGING.md`. Mínimo:

- **Estruturado (JSON)**, com campos obrigatórios: `timestamp` (ISO 8601 UTC), `level`, `service`/`module`, `event` (nome estável), `message`, `request_id`, `trace_id` + contexto relevante.
- **Níveis com disciplina:** DEBUG (dev), INFO (marcos: `carrossel_criado`, `carrossel_importado`, `slide_editado`, `export_concluido`), WARN (recuperável: `licenca_cache_usada`, `imagem_retry`), ERROR (falhou: `export_falhou`, `licenca_invalida`), FATAL.
- **Correlação por `trace_id`** da jornada inteira: criar (skills) → `slides.json` → editar → gerar imagem → exportar.
- **Fronteira de IA instrumentada:** registrar chamada ao modelo de imagem (latência, modelo/versão, `trace_id`) e eventos de validação (`slides_json_invalido`, `output_barrado`). **Nunca** logar o conteúdo sensível, a chave, nem a auth do Claude Code do cliente.
- **NUNCA logar:** chave de imagem do cliente, segredo de licença, tokens/auth do Claude Code, PII. Logar identificador, não o dado.

---

## 5. Commits

Segue `docs/00-fundamentos/DISCIPLINA-DE-COMMITS.md`: commits atômicos, Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`), `main` sempre implantável. Um commit = uma mudança coerente. Não misturar reskin com adapter com skills com lógica de licença no mesmo commit.

---

## 6. Padrões de código

Segue `docs/00-fundamentos/PRINCIPIOS-DE-ENGENHARIA.md`:

- **Nomenclatura:** funções `camelCase`; tipos/componentes `PascalCase`; booleanos afirmativos (`isAtivo`, `hasLicenca`). Pastas por **feature**, não por tipo técnico.
- **Erros:** esperados = **valor de retorno tipado** (não exceção); excepcionais = falha barulhenta + log. **`catch` vazio é proibido.**
- **Imutabilidade por padrão;** evitar estado mutável compartilhado.
- **SOLID pragmático:** uma responsabilidade por módulo; depender de abstração nas fronteiras (editor, CLI de texto, imagem, licença).
- **Sem comentário óbvio** — só o "porquê" não-evidente (regra do CLAUDE.md).

---

## 7. O que o agente NÃO decide (pare e pergunte)

- Trocar a stack interna do Open Design (framework, bundler, build).
- Tocar no core do fork **além** da camada de reskin, do adapter `slides.json`↔documento, e da camada de skills/staging.
- Reimplementar a orquestração do agente de texto (o CLI spawnado pelo daemon) ou trocá-la por chamada direta ao Anthropic SDK.
- Adicionar qualquer dependência nova.
- Mudar o schema do `slides.json` (é contrato versionado).
- Mudar tokens de marca / identidade visual da Root.
- Mudar o mecanismo de licença (fluxo, cache, segredo) ou onde o segredo mora.
- Reintroduzir Playwright / manter o `render.mjs` como caminho de produção.
- Ampliar o escopo de acesso do CLI de texto além do diretório do projeto (`--add-dir` extra, disco inteiro).
- Qualquer coisa que faça dado do cliente (chave de imagem, auth do Claude Code, conteúdo) sair da máquina dele.
