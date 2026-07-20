# Máquina de Carrossel — V03 (Operação Root)

Motor de criação de conteúdo próprio e customizado da **Operação Root**, distribuído ao cliente e gated por licença. **Um produto só:** um **editor visual profissional estilo Canva** (fork/embed do [Open Design](https://github.com/nexu-io/open-design), Apache-2.0, reskinnado com a cara da Root) com **toda a metodologia de criação embutida dentro dele**.

Como funciona por dentro:

- **Criação (o "cérebro")** — o editor **spawna o Claude Code que o cliente já tem instalado**, em modo headless, e roda o motor editorial evoluído da V02: brief → triagem → 10 headlines → espinha → 1 de 5 frameworks → copy → QA anti-slop → produz o contrato `slides.json`. A metodologia não é um plugin instalado à parte: são **skills + subagents de Claude Code** (o mesmo primitivo `SKILL.md`) que o editor encena no diretório de trabalho e o Claude Code do cliente lê. A inferência de texto é paga pelo cliente (os tokens da conta de Claude dele).
- **Edição + render (as "mãos")** — o mesmo editor consome o `slides.json`, mostra os slides e deixa o cliente **editar livremente**: troca imagem, gera imagem, muda cor, muda título, reordena — e exporta os PNGs finais 1080×1350.

Não há mais duas metades para instalar e costurar: é **uma ferramenta** (o editor reskinnado). O `slides.json` continua sendo o **hand-off interno** entre a fase de criação (skills) e a fase de render/edição (adapter + export).

## Princípios de produto (inegociáveis)

1. **Local-first** — o editor roda 100% na máquina do cliente. A única dependência de rede é a validação de licença contra a VPS (com cache offline).
2. **Roda no Claude Code do cliente** — o editor usa o Claude Code que o cliente já tem (auth, assinatura e tokens dele). A Root não hospeda nem paga a inferência de texto.
3. **Chave de imagem é do cliente** — ele conecta a própria API de geração de imagem dentro do editor. A Root não hospeda nem paga geração.
4. **Reskin total** — nada na UI pode denunciar que é Open Design (nome, logo, ícones, splash, textos e metadados viram identidade Root).
5. **O editor aposenta o `render.mjs`/Playwright** — a partir da V03 a exportação do editor é a única superfície de render.
6. **Audiência = quem usa Claude Code** (alvo estreito, intencional).

## Metodologia

Este projeto segue o kit de metodologia de engenharia em 6 camadas. Documentos em `docs/`:

| Camada | Documento | Status |
|--------|-----------|--------|
| 0 — Fundamentos (contexto fixo) | [`docs/00-fundamentos/`](docs/00-fundamentos/) | pronto |
| 1 — PRD faseado | [`docs/01-prd.md`](docs/01-prd.md) | v0.2 |
| 2 — Constraints (regras do agente) | [`docs/02-constraints.md`](docs/02-constraints.md) | v0.2 |
| 3 — Arquitetura | [`docs/03-arquitetura.md`](docs/03-arquitetura.md) | v0.2 |
| 4 — Design System | [`docs/04-design-system.md`](docs/04-design-system.md) | v0.1 |
| 5 — Páginas & Queries | [`docs/05-paginas-queries.md`](docs/05-paginas-queries.md) | v0.1 |
| 6 — Segurança OWASP-LLM | [`docs/06-seguranca-owasp.md`](docs/06-seguranca-owasp.md) | v0.2 |

Registros de sessão (fora das camadas):

| Doc | O que registra |
|---|---|
| [`docs/09-correcao-identidade-de-marca.md`](docs/09-correcao-identidade-de-marca.md) | auditoria do "todo carrossel sai com a cara da Root" + as 5 ondas de correção (20/07/2026) |

**Regra de ouro:** entregar ao agente de código como contexto fixo os fundamentos (Camada 0) + Constraints (2) + Arquitetura (3), e então **uma fase do PRD por vez** — nunca o sistema inteiro de uma vez.

## Estado atual (09/07/2026)

Fase 1 tecnicamente completa no fork (`~/dev/root-editor`, repo privado `pedromagnago/root-editor`): reskin Root no chrome (título, paleta lime/ink, splash, fontes, i18n), import do `slides.json` real da V02, edição estruturada com painel, export determinístico em paridade de pixel (≤1,10% vs V02), 4 estados + logging com `trace_id`. Fase 3 embutida: skill `carrossel-root` + auto-render + fluxo "Novo carrossel". **Multi-marca ligado (09/07)**: o render honra o `brand_pack_ref` do contrato — brand packs de `~/.maquina-carrossel/marcas/<slug>/` (mesmo schema `brandpack/v1` da V02), pack Root empacotado como default com paridade byte a byte provada por teste, seletor de marca na UI. Ícones binários do app (dock/taskbar, 4 plataformas) trocados pelo R+cursor da Root. Falta: dogfooding cronometrado (1.H, Pedro), aposentadoria formal do `render.mjs`, Fase 2 (IA de imagem) e Fase 4 (licença + empacotamento distribuível).

## Predecessora

A **V02** (`../maquina_de_carrossel.v02/`) é um plugin de Claude Code funcional: pipeline editorial + contrato `slides.json` + `render.mjs` (Playwright → PNG 1080×1350). A V03 **traz o pipeline da V02 para dentro do editor** (como skills/subagents de Claude Code) e substitui o `render.mjs` por um editor interativo com export próprio.
