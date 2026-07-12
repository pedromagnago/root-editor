# Root Editor

Editor visual **local-first** da máquina de carrossel da **Operação Root**: do tema ao PNG 1080×1350 pronto pra postar, sem sair do editor. A metodologia editorial roda embutida — o editor spawna o **Claude Code que você já tem instalado** (sua conta, seus tokens) e conduz o pipeline: triagem → headlines → espinha → texto slide a slide → QA → deck visual → edição livre → export.

Tudo roda na sua máquina. Nenhum servidor da Root recebe seu conteúdo.

## Pré-requisitos

| O quê | Versão | Nota |
|---|---|---|
| Node.js | **24** (`~24`) | Node 22 quebra com `ERR_UNKNOWN_FILE_EXTENSION`. O repo tem `.node-version` — `mise`/`fnm` trocam sozinhos. |
| pnpm | 10 | `corepack enable` ativa a versão pinada no `package.json`. |
| Claude Code | atual | Instalado e **autenticado na sua conta** (`claude` no PATH). É ele que escreve o carrossel. |
| SO | macOS, Linux ou WSL2 | Windows nativo funciona; veja `docs/windows-troubleshooting.md`. |

## Clone e rode

```bash
git clone https://github.com/pedromagnago/root-editor.git
cd root-editor
pnpm install
pnpm tools-dev start
```

O `tools-dev` sobe daemon + web e imprime as URLs (`pnpm tools-dev status` mostra de novo). Abra a URL do **web** no navegador.

## Primeiro carrossel

1. Na home, clique **Novo carrossel** e escreva o tema (ou cole o insumo: texto, dados, case).
2. O Claude Code roda o pipeline editorial e escreve o `slides.json`; o deck aparece renderizado ao lado do chat.
3. Edite no painel: headline, blocos, cor de fundo por token, reordenar slides.
4. Exporte: **Baixar slides** → zip com um PNG 1080×1350 por slide (ou 2160×2700).

## Marca

Os slides saem com a cara da **sua marca** via brand pack (`brand.json` + `skin.css`) em `~/.maquina-carrossel/marcas/<slug>/`:

- Sem marca cadastrada, o primeiro "Novo carrossel" faz um **intake rápido** no chat (nome, cores, voz) e cria o pack pra você.
- O seletor no card "Novo carrossel" troca a marca ativa quando há mais de uma.
- A paleta completa é derivada da sua cor primária; `skin.css` refina o visual por cima.

O pack da Root vem embutido como default de fábrica.

## Estrutura (pra quem for mexer)

- `apps/daemon` — Node/TS: spawna o Claude Code, valida o contrato `slides.json`, renderiza o deck, serve a API.
- `apps/web` — Next.js/React: o editor.
- `apps/desktop` — Electron: captura/export e app empacotado.
- `skills/carrossel-root/` — a metodologia editorial (skill de Claude Code encenada no projeto).
- Referência avançada do fork (dev, Docker, troubleshooting): [`QUICKSTART.md`](QUICKSTART.md) e [`docs/UPSTREAM-README.md`](docs/UPSTREAM-README.md).

## Créditos e licença

Fork do [Open Design](https://github.com/nexu-io/open-design) (Apache-2.0) — a licença e a atribuição estão preservadas em [`LICENSE`](LICENSE). O pipeline editorial, o contrato `slides.json`, o render de carrossel e a identidade Root são da Operação Root.
