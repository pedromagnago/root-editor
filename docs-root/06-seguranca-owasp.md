# Camada 6 — Segurança OWASP-LLM (Máquina de Carrossel V03)

> **v0.2 · portão obrigatório antes de distribuir ao cliente.** Princípio-mestre: **defesa em camadas** — nenhum controle isolado cobre tudo.
>
> **Mudança 0.1 → 0.2 (pivot):** a criação de texto deixou de ser um "plugin instalado à parte" e virou **skills/subagents de Claude Code encenadas no diretório de trabalho e executadas pelo Claude Code do cliente, spawnado headless pelo editor com `--permission-mode bypassPermissions`**. Isso **muda a superfície de risco de LLM06 (agência excessiva)**: a contenção não vem mais de prompts de permissão do Claude Code, e sim de **manter o diretório de trabalho + `--add-dir` no mínimo**. Também entra na conta o `.mcp.json` auto-carregado do diretório de trabalho.
>
> **Escopo por fase:** a Fase 1 (dogfooding só Root, sem IA de imagem, sem gating, sem criação por IA embutida) exige o subconjunto marcado **[F1]**. Os controles de criação por IA valem a partir da **Fase 3** (metodologia embutida). O portão **completo** vale antes da **Fase 4** (distribuição/licença), quando o produto sai da máquina da Root para a de terceiros.
>
> **Superfície de risco desta arquitetura:** o código roda na **máquina do cliente** (público técnico), com dois pontos de IA (texto no Claude Code do cliente spawnado pelo editor; imagem via chave do cliente) e um único serviço Root exposto (endpoint de licença na VPS).

---

## Os 10 riscos e seus controles

### LLM01 — Prompt Injection (risco nº 1)
Entradas que a criação processa (brief, tema, dados de pesquisa, conteúdo trazido da web) e o texto/prompt no editor podem conter instrução maliciosa. Crítico porque a **criação roda no Claude Code do cliente, que tem ferramentas com acesso ao sistema de arquivos — e roda com `bypassPermissions`**.
- [ ] **[F1]** Conteúdo externo (tema, web, texto do slide) tratado como **dado, nunca comando**.
- [ ] **[F1]** Diretório de trabalho e `--add-dir` **no mínimo** (só o projeto): o menor privilégio aqui é o principal freio de injeção (ver LLM06).
- [ ] Filtragem de entrada/saída em cada fronteira (criação→`slides.json`, editor→imagem).
- [ ] Aprovação humana para ações de alto impacto (sobrescrever, exportar, lote).
- [ ] Teste adversarial por versão ("consegui fazer o brief injetar comando que escapa do diretório do projeto?").

### LLM02 — Vazamento de informação sensível
Segredos em jogo: **auth/tokens do Claude Code do cliente**, **chave de imagem do cliente** e **segredo de assinatura da licença**.
- [ ] **[F1]** Nenhum segredo no prompt sem necessidade.
- [ ] **[F1]** Chave do cliente, auth do Claude Code e prompt sensível **nunca** em log/telemetria (Camada 2 §4).
- [ ] Minimização: só o necessário entra no contexto do modelo.
- [ ] Segredo de assinatura da licença mora **só na VPS** (ver LLM07).

### LLM03 — Cadeia de suprimentos  ⚠️ alta relevância
Estamos **forkando um repositório de ~73k estrelas** (Open Design) + suas dependências + o provider de imagem. O merge de upstream é o acoplamento real do projeto.
- [ ] **[F1]** Versão do upstream (Open Design) **fixada e auditada**; atualização é decisão consciente, não automática.
- [ ] **[F1]** Dependências com versão fixada (lockfile); origem verificada.
- [ ] Provider de imagem de fonte conhecida; contrato do gateway isola o app de trocas de provider.
- [ ] Revisar o diff de cada atualização de upstream antes de puxar (o reskin e as skills isolados ajudam a auditar).

### LLM04 — Envenenamento de dados/modelo
A base de conhecimento da criação (frameworks editoriais, regras de marca, skills/subagents `SKILL.md`, `knowledge/`) guia a geração.
- [ ] **[F1]** Skills/subagents e regras de marca de **fonte controlada** (repositório da Root, versionado) — nunca encenar no diretório de trabalho conteúdo de origem não confiável.
- [ ] Validação de procedência de qualquer conteúdo indexado/trazido para o contexto.
- [ ] Só MCPs confiáveis no `.mcp.json` do diretório de trabalho (o daemon auto-carrega o do cwd — ver LLM06).

### LLM05 — Tratamento inadequado de saída  ⚠️ alta relevância
Duas saídas de IA cruzam fronteira: o `slides.json` (da criação) e a imagem/texto (no editor).
- [ ] **[F1]** `slides.json` **validado contra o schema antes** de o editor carregar (contrato é o portão).
- [ ] **[F1]** Texto gerado sanitizado antes de virar nó no documento — **sem HTML/script injetado** no render.
- [ ] Imagem validada (formato/tamanho) antes de gravar.
- [ ] Saída da IA nunca executada diretamente.

### LLM06 — Agência excessiva  ⚠️ alta relevância (mudou com o pivot)
O Claude Code do cliente, spawnado pelo editor, roda com **`--permission-mode bypassPermissions`** — ou seja, **não** há prompt de permissão a cada ação; ele tem ferramentas com efeito no sistema de arquivos e executa comandos. A contenção é **arquitetural**, não interativa.
- [ ] **[F1]** **Diretório de trabalho restrito ao projeto**; `--add-dir` só com os diretórios estritamente necessários — **nunca o disco inteiro nem o home**.
- [ ] **[F1]** `.mcp.json` do diretório de trabalho contém **apenas** MCPs confiáveis da Root (o daemon o auto-carrega; um `.mcp.json` malicioso no cwd é escalonamento de privilégio).
- [ ] Ações com efeito colateral fora do fluxo esperado (escrever fora do projeto, exportar por cima) passam por checagem/monitoramento.
- [ ] Não ampliar o escopo do agente "por conveniência" (Camada 2 §7: o agente não decide alargar o próprio acesso).

### LLM07 — Vazamento de system prompt
As skills/subagents (`SKILL.md`), `knowledge/` e comandos da criação são **encenados no diretório de trabalho, no disco do cliente** — assuma que são lidos.
- [ ] **[F1]** Skills / system prompt / instruções **não contêm segredo** (assuma exposição total).
- [ ] O segredo de assinatura da licença **não** está nas skills nem no editor distribuído — só na VPS.

### LLM08 — Fraquezas em embeddings/vetores (RAG)
- [ ] Se houver busca vetorial sobre `knowledge/`: é **local e mono-usuário** → risco de vazamento cruzado baixo. Reavaliar se algum dia virar multiusuário. (Não aplicável na Fase 1 se não houver RAG.)

### LLM09 — Desinformação
O conteúdo pode afirmar dados/estatísticas errados (slop factual).
- [ ] **[F1]** QA anti-slop da criação + **revisão humana** antes de publicar.
- [ ] Pesquisa exige **fonte + ano** verificáveis (munição do pipeline), não número inventado.
- [ ] Deixar claro que o conteúdo é assistido por IA e pode conter erro.

### LLM10 — Consumo ilimitado
Inferência de **texto** (Claude Code do cliente) e **imagem** (chave do cliente) roda na **conta do cliente** — o custo de abuso é dele, mas ainda protegemos contra estouro acidental (ex.: loop de geração, sessão de agente que não encerra). O que é **custo/DoS da Root** é o endpoint de licença.
- [ ] Limite de custo/geração de imagem no editor (evitar loop de geração acidental).
- [ ] Guardas na sessão de criação (timeout/limite de turnos do agente) — evitar loop caro na conta do cliente.
- [ ] **Rate limiting no endpoint de licença** (VPS) — superfície de abuso/DoS da Root (Fase 4).
- [ ] Timeouts em toda chamada externa (imagem, licença).

---

## Antes de distribuir (portão — Fase 4)
- [ ] Validação de entrada e saída ativa em todas as fronteiras (brief, `slides.json`, imagem, licença).
- [ ] Menor privilégio do agente de criação: diretório de trabalho + `--add-dir` mínimos; `.mcp.json` do cwd só com MCPs confiáveis.
- [ ] Supervisão humana nos pontos de alto impacto (sobrescrever, exportar, publicar).
- [ ] Monitoramento e log ativos, com eventos de segurança (`slides_json_invalido`, `licenca_invalida`, `output_barrado`) sob `trace_id`.
- [ ] Teste adversarial executado nesta versão (incl. tentativa de escapar do diretório do projeto via injeção).
- [ ] **Nenhum segredo** no cliente, nas skills/system prompt, ou no histórico de commits (a chave de assinatura só na VPS; a chave de imagem e a auth do Claude Code são do cliente e ficam locais).
- [ ] Upstream (Open Design) e dependências fixados e auditados nesta release.

## Portão mínimo da Fase 1 (dogfooding Root)
Só os itens **[F1]**: injeção tratada (dado≠comando), diretório de trabalho/`--add-dir` no mínimo, `slides.json` validado por schema antes do render, texto sanitizado, versões fixadas, skills/`knowledge/` de fonte controlada, sem segredo no que é distribuído, QA anti-slop + revisão humana.
*(A criação por IA embutida só entra na Fase 3; na Fase 1 os itens de LLM06 valem para o ambiente de dev da Root que já roda o fork.)*

---

## Referências
- OWASP — *Top 10 for LLM Applications 2025* — genai.owasp.org (fonte primária)
- `docs/00-fundamentos/OBSERVABILIDADE-E-LOGGING.md` — eventos de segurança e schema de log
