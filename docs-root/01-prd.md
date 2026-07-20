# PRD — Máquina de Carrossel V03 (Operação Root)

> Documento de intenção, lido por humanos. Conta o quê e o porquê. Versione-o.
> **Versão:** 0.2 · **Data:** 01/07/2026 · **Status:** rascunho
>
> **Mudança 0.1 → 0.2 (pivot):** o produto deixou de ser "duas metades para instalar" (um plugin de Claude Code + um editor separado) e virou **um produto só**: o editor reskinnado, com a metodologia de criação **embutida dentro dele**. O editor **spawna o Claude Code que o cliente já tem instalado** (headless) e roda o pipeline editorial como **skills/subagents de Claude Code** (evolução da V02). Mata o passo de instalar/costurar um plugin. O `slides.json` continua existindo — agora como **hand-off interno** entre a fase de criação (skills) e a fase de edição/render (editor + export).

---

## 1. Resumo executivo

A V03 é um produto de criação de carrossel **distribuído ao cliente e liberado por licença**: um **editor de imagem profissional estilo Canva** (reskinnado com a cara da Root) com **toda a metodologia de criação embutida**. Dentro do editor, o cliente descreve o tema; o editor **aciona o Claude Code que o cliente já tem instalado** (rodando headless, com a conta/tokens dele) e executa o motor editorial — brief → triagem → 10 headlines → espinha → 1 de 5 frameworks → copy → QA anti-slop — materializado como **skills e subagents de Claude Code** (o mesmo primitivo `SKILL.md` da V02). O resultado (`slides.json`) cai na tela de edição, onde o cliente ajusta livremente (trocar imagem, gerar imagem, mudar cor, mudar título, reordenar) e exporta os PNGs. O cliente paga a inferência de texto com os tokens do próprio Claude; a Root entrega o método e a ferramenta. O sucesso será medido pela redução do tempo de "ideia → carrossel publicável" e pela capacidade do cliente de criar e editar sozinho, sem designer e **sem setup de plugin**.

## 2. Problema

- **Dor real:** produzir carrossel de qualidade profissional e recorrente hoje custa ou horas de design manual (Canva na mão, slide a slide) ou a contratação de um designer. A V02 já resolve o *texto* (pipeline editorial → `slides.json` → PNG determinístico), mas o resultado é **read-only**: o cliente recebe o PNG e não consegue ajustar nada sem voltar ao código. Falta a camada de **edição visual na mão do cliente** — e, no desenho original de "duas metades", faltava também tirar o atrito de **instalar e costurar um plugin separado** antes de criar.
- **Por que agora:** (a) a V02 provou o contrato de render (`slides.json` → HTML/CSS → PNG) e a voz de marca versionada em `brand.json`; (b) existe base open source madura e de licença permissiva — **Open Design (Apache-2.0)** — que entrega um editor local-first estilo Canva pronto para forkar, reskinnar e distribuir fechado **e que já sabe orquestrar um agente de código local**: o daemon dele **spawna o CLI de código que o cliente tem** (Claude Code, entre outros) e encena skills no diretório de trabalho — ou seja, dá para embutir a metodologia como skills em vez de reescrevê-la; (c) geração de imagem por IA (texto→imagem, provider-agnóstico) barateou a ponto de caber no fluxo.
- **Custo de não fazer:** a Root continua entregando um artefato fechado (PNG) que o cliente não domina, dependente de retrabalho manual a cada ajuste; e continua sem um produto próprio distribuível — refém das ferramentas hospedadas do fornecedor (lock-in) em vez de ter um ativo com a cara da Root.

## 3. Usuário e contexto

- **Persona principal:** operador de conteúdo do nicho da Root (criador, pequena agência ou dono de negócio) que produz carrossel com recorrência, **não é designer**, trabalha em desktop (Mac), e **já usa o Claude Code** (tem instalado e autenticado). A Root é o **cliente zero** (dogfooding) antes de qualquer distribuição externa.
- **Job-to-be-done:** "quando eu tenho um tema para postar, quero transformá-lo num carrossel na voz da minha marca e ainda ajustar o visual eu mesmo, para publicar rápido sem depender de designer."
- **Como resolve hoje:** Canva manual (lento, sem método editorial), designer terceirizado (caro, lento no ajuste), ou a V02 (resolve o texto mas entrega PNG fechado, sem edição).
- **Cenários de uso:**
  1. **Criação guiada (dentro do editor):** o cliente abre o editor Root e descreve o tema. O editor aciona o Claude Code dele (headless), que roda o pipeline (triagem → 10 headlines → espinha → framework → copy → QA anti-slop) usando as skills/subagents da Root encenadas no diretório de trabalho; ao final, os slides (`slides.json`) já aparecem prontos para editar — sem trocar de janela, sem instalar plugin.
  2. **Edição visual:** no mesmo editor, o cliente troca a imagem de capa, gera uma imagem nova por IA, muda a cor de um bloco (dentro dos tokens da marca), reescreve um título, reordena slides — e exporta os PNGs 1080×1350.
  3. **Iteração de marca:** cliente ajusta o `brand.json` (cores, fontes, palavras proibidas) e as próximas criações já saem no novo padrão, sem tocar em código.

## 4. Onde a IA entra (e onde não entra)

- **Caso de uso da IA — criação de texto (o "cérebro"):** agente-com-ferramentas rodando no **Claude Code do cliente, spawnado headless pelo editor**. Gera headlines, escolhe 1 de 5 frameworks, escreve a copy dos slides e roda o **QA anti-slop** (filtro de clichês, 2ª pessoa proibida, palavras banidas da marca). É o pipeline da V02, **reempacotado como skills/subagents de Claude Code** — não um SDK, não um serviço hospedado: o CLI real do cliente lendo os `SKILL.md` da Root no diretório de trabalho.
- **Caso de uso da IA — imagem (as "mãos"):** modelo texto→imagem **provider-agnóstico** (ex.: Gemini 2.5 Flash Image / "nano-banana", ou equivalente) acionado dentro do editor para **gerar** e **trocar** imagens de slide.
- **Fronteira do determinístico (NÃO é IA):**
  - O **contrato de render** (`slides.json`) e a materialização em pixels são determinísticos — mesma entrada, mesmo PNG.
  - As **regras de marca** (paleta, tipografia, tokens, palavras proibidas, 1 capa + 1 fechamento, ordem sequencial) são guardas fixas, validadas por schema — não improviso do modelo.
  - A **licença/gate** é lógica determinística (chave → verificação na VPS), nunca decisão do modelo.
- **Tolerância a erro:** o cérebro erra copy → o cliente revisa e reescreve no editor (revisão humana embutida no fluxo). A IA de imagem erra → o cliente descarta e regenera/troca (nenhuma imagem entra sem o olho humano). Nada é publicado automaticamente; o export é ação explícita do cliente.

## 5. Métricas de sucesso

| Métrica | Linha de base | Meta | Como medir |
|---------|--------------|------|------------|
| Tempo "tema → carrossel exportado" | ~2–4 h (Canva manual) | < 15 min | cronometragem de sessões reais (Root dogfooding) |
| Ajustes feitos pelo cliente sem designer | 0% (PNG fechado na V02) | ≥ 90% dos ajustes | contagem de edições no editor vs. pedidos a terceiro |
| Aprovação no QA anti-slop na 1ª geração | [medir na V02 atual] | ≥ 80% dos slides | log do filtro anti-slop por peça |
| Ativação do cliente (abrir editor → 1º carrossel exportado) | — | < 30 min | telemetria do editor (evento de 1º export) |

## 6. Fases (Fase 1 detalhada; 2–5 esboçadas, a expandir quando ativadas)

> Entrega ao agente de código **uma fase por vez**. A Fase 1 é o menor conjunto que já entrega valor novo sobre a V02: **o editor visual próprio**. Rodamos primeiro **local, só para a Root** (dogfooding), antes de embutir a criação por IA, o gating e a distribuição.

### Fase 1 — Editor visual próprio (Open Design reskin) alimentado por `slides.json` · MVP
**Objetivo da fase:** pegar o `slides.json` que a V02 já produz, abrir num editor local estilo Canva com a cara da Root, permitir edição básica e exportar os PNGs — provando o espinhaço (embed + reskin + ingestão do contrato + export) antes de qualquer IA (texto ou imagem), gating ou distribuição.

- [ ] Forkar/embutir o Open Design (Apache-2.0) como base do editor, rodando local (local-first), preservando a atribuição exigida pela licença.
- [ ] Reskin visual "cara da Root" (**inegociável**): paleta lime `#9BDB1F` sobre `#070A08`, tipografia JetBrains Mono + Space Grotesk, via tokens (nada hard-coded). Nada na UI pode denunciar que é Open Design — nome, logo, ícones, splash, textos e metadados trocados pela identidade da Root.
- [ ] Adapter `slides.json` → documento do editor: importar meta, `brand_pack_ref`, e cada slide (bg, headline, blocos, componentes, source, cta, imagem) para objetos editáveis.
- [ ] Renderização fiel: o slide dentro do editor bate visualmente com o PNG que a V02/`render.mjs` produz hoje (mesmos tokens de marca). *(Provado nos Spikes 2–3: DOM byte-idêntico ao baseline + paridade de pixel.)*
- [ ] Edição de texto: cliente edita headline, blocos e tags in-place; respeitando `<strong>`/`<em>` permitidos.
- [ ] Edição de cor por token: trocar `bg` e cores de componente escolhendo entre os tokens do `brand.json` (não color picker livre nesta fase).
- [ ] Reordenar, adicionar e remover slides mantendo as regras (exatamente 1 capa na ordem 1, 1 fechamento por último, ordem sequencial).
- [ ] Navegação e preview de todos os slides do carrossel (contact sheet / grid).
- [ ] Export: gerar os PNGs 1080×1350 a partir do estado editado, com **`deviceScaleFactor` explícito** (o alvo autorado 1080/420 = 2,5714) para saída determinística entre máquinas. **O editor aposenta o `render.mjs`** — a partir da V03 é a única superfície de render+edição (o Playwright/`render.mjs` da V02 é descontinuado). Testar paridade visual contra os PNGs da V02 antes de descontinuar.
- [ ] Persistência local do projeto editado (abrir, salvar, reabrir sem perder edições).
- [ ] Os 4 estados em toda tela do editor: carregando, erro, vazio, sucesso.
- [ ] Logging estruturado dos eventos do editor (importou, editou, exportou) com `trace_id`.
- [ ] Rodar de ponta a ponta na máquina da Root consumindo uma saída real da V02 (`~/.maquina-carrossel/saidas/...`).

### Fase 2 — IA visual: gerar e trocar imagem no editor
**Objetivo da fase:** trazer o "gera imagem / troca imagem" para dentro do editor, com modelo texto→imagem provider-agnóstico.
- [ ] Trocar imagem de um slide por upload de arquivo local.
- [ ] Gerar imagem por prompt (texto→imagem), provider-agnóstico, com o resultado caindo no slide selecionado.
- [ ] Revisão humana obrigatória: nenhuma imagem gerada entra sem o cliente aceitar.
- [ ] A chave de imagem é do **cliente**, conectada por ele dentro do próprio editor. A Root não hospeda nem paga geração de imagem.
- [ ] Instrumentar chamada ao modelo de imagem (latência, custo/uso, sucesso/erro).

### Fase 3 — Metodologia embutida: criação por IA dentro do editor
**Objetivo da fase:** fechar o fluxo "tema → carrossel" **sem sair do editor e sem plugin instalado à parte** — o editor spawna o Claude Code do cliente e roda o pipeline editorial da V02 como skills/subagents, entregando o `slides.json` direto na fase de edição.
- [ ] Portar o pipeline editorial da V02 para **skills + subagents de Claude Code** (o mesmo primitivo `SKILL.md`), versionados no repositório da Root.
- [ ] O editor encena as skills/subagents da Root no diretório de trabalho (padrão de staging do fork) e **spawna o Claude Code do cliente** (headless) para executá-las com a conta/tokens dele.
- [ ] A criação continua a mesma sessão do agente entre turnos (retomar/continuar), como o fork já faz.
- [ ] Ao concluir, o `slides.json` produzido é **validado contra o schema** e carregado na tela de edição — o hand-off interno criação→edição.
- [ ] Contrato estável do `slides.json` (interface versionada entre a fase de criação e a de edição/render).

### Fase 4 — Gating por licença + distribuição ao cliente
**Objetivo da fase:** a distribuição do editor, a chave que libera acesso, e a expansão para clientes além da Root.
- [ ] Gate por licença — **chave validada contra a VPS** (ativação/revogação/telemetria), com cache offline (reaproveita padrão HMAC de tools.fullbpo.com).
- [ ] Empacotar e distribuir o editor Root (o cliente instala **a ferramenta**; o Claude Code é pré-requisito que ele já tem).
- [ ] Brand pack por cliente (cada cliente com seu `brand.json`).

### Fase 5 — Robustez, multicliente e portão de segurança
**Objetivo da fase:** endurecer para uso real por vários clientes.
- [ ] Observabilidade completa (Camada 0) e limites de uso/custo.
- [ ] Portão OWASP-LLM (Camada 6) revisado antes de liberar distribuição ampla — com atenção ao `--permission-mode bypassPermissions` do CLI spawnado (Camada 6, LLM06).
- [ ] Documentação de onboarding do cliente.

## 7. Requisitos não-funcionais

- **Desempenho:** abrir o editor com a peça carregada em poucos segundos; export dos PNGs em tempo comparável ou melhor que o `render.mjs` atual.
- **Escala:** Fase 1 mono-usuário (Root). Multicliente só na Fase 4+; sem colaboração em tempo real na V03.
- **Disponibilidade:** local-first — o editor roda **na máquina do cliente** e não depende de serviço hospedado da Root para criar nem editar. A criação de texto depende do Claude Code do cliente (local, conta dele). Única dependência de rede da Root: a validação de licença contra a VPS (com cache offline de alguns dias).
- **Conformidade:** a **inferência de texto roda no Claude Code do cliente** (conta/tokens dele — a Root não vê nem paga); a **chave de imagem é do próprio cliente**, conectada por ele dentro do editor — a Root nunca a vê nem a hospeda; atribuição da licença Apache-2.0 do Open Design preservada no código-fonte.

## 8. Riscos e dependências

| Risco / Dependência | Impacto | Mitigação |
|---------------------|---------|-----------|
| Manter um fork do Open Design (monorepo ~73k estrelas) vira fardo; merge de upstream é o acoplamento real | alto | isolar o reskin/adaptação em camada fina nossa; tocar o mínimo do core; fixar versão upstream; revisar diff a cada atualização |
| A criação depende das convenções de **staging de skills / runtime-def** do fork (como ele encena `SKILL.md` e spawna o CLI) | médio | tratar o staging como fronteira; se o fork mudar o mecanismo, é ponto único de ajuste; a metodologia em si é `SKILL.md` portável |
| Fidelidade do adapter `slides.json` → documento do editor | médio | tratar `slides.json` como contrato versionado; testes de render comparando com PNG da V02 *(paridade já provada nos Spikes 2–3)* |
| Gate de licença é fraco num tool local com público técnico (cliente tem o código) | médio | não perseguir DRM forte; **chave de licença validada contra a VPS** (ativação/revogação/telemetria) + valor recorrente (updates/método/suporte) atrás da licença ativa |
| `--permission-mode bypassPermissions` no CLI spawnado dá agência ampla ao agente | médio | sandbox por diretório de trabalho + `--add-dir` mínimo; sem conceder disco inteiro (Camada 6, LLM06) |
| Chave de imagem é do cliente | baixo | cliente conecta a própria API no editor; Root não hospeda nem custeia geração |
| Distribuição é só para quem usa Claude Code (audiência estreita, intencional) | médio | alvo assumido; revisar tamanho de mercado antes de escalar distribuição na Fase 4 |
| Aposentar o `render.mjs` exige paridade visual do export do editor | baixo | testes de paridade contra os PNGs da V02 antes de descontinuar o Playwright *(provado no Spike 3)* |

## 9. Fora de escopo (explícito)

- **Vídeo / Palmier Pro** — geração de vídeo é fechada/paga e Swift-macOS-only; aposta separada e posterior, não entra na V03.
- **MCP/app hospedado do fornecedor** — não dependemos das ferramentas hospedadas; o produto é próprio.
- **SaaS multi-tenant hospedado com inferência paga pela Root** — só se o modelo de negócio virar para esse lado (decisão em aberto).
- **Plugin de Claude Code instalado à parte** — descartado no pivot; a metodologia vive **dentro do editor** como skills/subagents. (A V02 segue sendo plugin; a V03 não.)
- **Mobile e colaboração em tempo real.**
- **Automação de publicação** (postar direto nas redes) — o export é o fim do fluxo na V03.

## 10. Questões em aberto

**Resolvidas (01/07/2026):**
- [x] **Hosting do editor:** roda 100% na **máquina do cliente** (local-first puro).
- [x] **Modelo de criação (o pivot):** a metodologia é **embutida no editor** como skills/subagents de Claude Code, executadas pelo **Claude Code do cliente spawnado headless pelo editor** — não um plugin instalado à parte, não um SDK, não um serviço hospedado.
- [x] **Framework/execução do fork:** confirmado por inspeção — Open Design é **daemon Node/TS + web React + shell desktop Electron**; o daemon **spawna o CLI de código local** e encena skills no diretório de trabalho. (Encerra a decisão adiada da Camada 2 §1 / Camada 3 §6.)
- [x] **Chave de geração de imagem:** é do **cliente**, conectada por ele dentro do editor. A Root não hospeda nem paga.
- [x] **Inferência de texto:** paga pelo cliente, no Claude Code dele (a Root não vê nem custeia).
- [x] **Audiência:** quem usa Claude Code — alvo assumido e intencional.
- [x] **Export:** o editor **aposenta o `render.mjs`** e passa a ser a única superfície de render.
- [x] **Mecanismo de licença:** **chave validada contra a VPS** (phone-home: ativação, revogação, telemetria de quem usa e pagou), com cache offline. Sem anti-tamper pesado (ROI negativo contra público técnico). Reaproveita a VPS + padrão HMAC do tools.fullbpo.com.

Nenhuma questão bloqueante em aberto para a Fase 1.
