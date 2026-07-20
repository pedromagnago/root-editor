# Correção de Identidade de Marca — auditoria e execução

> **Versão:** 1.0 · **Data:** 20/07/2026 · **Status:** executado (5 ondas), pendências no fim
> Registro da sessão que investigou "por que todo carrossel sai com a cara da Root" e corrigiu a causa.
> Companheiro do `03-arquitetura.md` (motor de marca) e do `07-roadmap-atividades.md` (status por fase).

---

## 1. O sintoma

Carrosséis da FullBPO — marca de BPO contábil, canvas branco, azul `#434cff` — saíam com **fundo preto e uma malha quadriculada** que não tem relação com a marca. A hipótese inicial (do Pedro e minha) era que **os templates estavam forçando** o padrão.

**A hipótese estava errada.** Uma contra-auditoria adversarial derrubou os dois primeiros diagnósticos, e o achado real só apareceu ao renderizar deck de verdade e ler o CSS composto.

---

## 2. As causas reais, em ordem de gravidade

### 2.1 O véu preto incondicional (a raiz)

`apps/daemon/assets/carousel/base.css` desenhava, sem token e sem condição:

```css
.slide.gradient .scrim, .slide.alert .scrim {
  background: linear-gradient(to top, rgba(0,0,0,.88) 0%, rgba(0,0,0,.68) 52%, rgba(0,0,0,.48) 100%);
}
```

E `slideHtml` emitia esse `<div class="scrim">` em **todo slide interno**. Como os 6 templates colocam **27 dos 39 slides** em `gradient`/`alert`/`dark`, a marca pintava o fundo com a cor dela e o motor cobria com até 88% de preto. **Nenhuma marca sobrescrevia** — o campo não existia no schema, então ninguém sabia que existia.

Consequência que passou despercebida em duas auditorias: a skin da FullBPO pinta `.slide.alert`/`.gradient` de azul, e o resultado renderizado era **quase preto**. O que parecia "18 slides escuros" eram na verdade 27.

### 2.2 Campos de marca declarados e nunca lidos

| Campo | Situação encontrada |
|---|---|
| `visual_tokens.cores.texto` | no schema, **nunca lido** pelo render |
| `visual_tokens.cores.bg` | no schema, **nunca lido** |
| `render_tokens.DT` / `LT` | **nem existiam** no schema; cravados em `DEFAULTS` |
| `copy_frameworks` | preenchido pela marca, **nunca consultado** pela metodologia |
| `voice_tone`, `personas`, `icp_ddd`, `facts`, `temas_editoriais`, `exemplos_ancora`, `quality` | **nunca citados** em nenhum arquivo da metodologia |
| "Estilo visual" (pergunta 4 do intake) | perguntado ao cliente, **sem campo onde gravar** |

O `SKILL.md` tinha **uma linha** ligando marca a conteúdo — um parêntese de seis palavras. A etapa que escreve os slides não mencionava voz nenhuma vez; a única ocorrência de "na voz da marca" no arquivo era sobre a legenda do Instagram.

### 2.3 Forma idêntica em qualquer marca

Zero `border-radius` vinha de token: 6 raios de forma cravados (6, 10, 12, 14, 16px), superfícies em cinza neutro fixo, e uma faixa de acento de 5px no topo de **todo** slide. A skin da FullBPO já sobrescrevia 5 seletores na unha só para mudar 12px → 8px — sintoma clássico de token faltando.

### 2.4 Bug de cascata na própria skin da FullBPO

```css
.slide.capa, .slide.alert, .slide.gradient { background: #434cff; }
.slide.dark { background: #111111; }   /* vinha DEPOIS */
```

O render emite `class="slide capa dark"` — as duas classes convivem, mesma especificidade, a última vence. **Toda capa escura saía `#111111`**, anulando o azul que a marca escolheu para a capa. O primeiro slide que o leitor vê.

A capa preta **não era herança da Root**: era a skin da FullBPO derrotando a si mesma.

### 2.5 Ninguém gerava a assinatura visual

O `SKILL.md` nunca mencionou `skin.css`. O intake criava só o `brand.json`. Resultado: a skin da FullBPO foi derivada da skin da Root e herdou a **malha de grid** que o próprio arquivo da Root declara como *"assinatura visual: terminal/hacker"*. Uma grade de terminal num BPO contábil — a "coisa quadrada".

---

## 3. O que foi executado (5 ondas)

Ordem por impacto sobre esforço. Cada onda é um commit isolado e reversível.

### Onda 1 — Metodologia (sem código)
`d74dc965`
- Bloco de voz na etapa de escrita, com os 7 campos editoriais nomeados e o que fazer com cada um.
- Bloco A2 no `checklist-validacao.md`, cujo primeiro item é o **teste do disfarce**: trocando o logo, um leitor da marca reconheceria que é dela?
- Gate de template passa a honrar `copy_frameworks`; `thread` entra no enum.
- `visual_tokens.estilo` criado; intake grava a resposta e ela dirige a geração da skin.
- Etapa de geração de `skin.css`, com tabela estilo → textura/raio/faixa/véu e o aviso de ordem de cascata da capa.

### Onda 2 — O véu preto
`7f80336e`
- `--SCRIM` e `--SCRIM-IMG` tokenizados. Default = comportamento antigo byte a byte; marca clara declara `none`.
- `--SCRIM-IMG` separado de propósito: texto sobre foto precisa de contraste em qualquer estilo.
- `cores.texto`/`cores.bg` passam a ser lidos, **pareados por luminância**: o par da marca descreve o tema dela, não os dois lados do deck. A Root declara `#DFFFE8` sobre `#070A08` — mapear esse texto para `--DT` pintaria verde-claro sobre fundo claro.
- `--FG-G`/`--FG-ALERT`: uma marca clara tem destaque em cor sólida, onde o texto certo não é o mesmo do fundo escuro.
- Cascata da skin da FullBPO corrigida.

### Onda 3 — Forma por marca
`182876a9`
- 6 tokens: `--R-CARD`, `--SURFACE`, `--BORDER`, `--BAR-H`, `--BAR-BG`, `--W-HEAD`.
- **Emitidos só quando declarados**; cada componente traz o valor histórico como fallback do `var()`. Os 6 raios eram 5 valores distintos — um token único não os reproduziria, e o fallback é o que mantém a âncora de paridade honesta em vez de regenerá-la em torno de um visual mudado.

### Onda 4 — `bg` como papel
`b2e74b6c`
- `bg` documentado como **papel narrativo**, com o que a marca controla em cada um.
- Instrução de adaptar a cor preservando o papel e a alternância, quando a marca é clara.
- **O enum não mudou** de propósito: renomear os 4 valores quebraria todo deck em disco, o validador e o schema de uma vez, para um ganho que a Onda 2 já entregou.
- Item correspondente no checklist visual.

### Onda 5 — Sugestão de imagem
`9b6bb269`
- `imagem.sugestao` (`cena`, `racional`, `origem`) — **ortogonal a `imagem.tipo`**, então o render não muda e o risco visual é zero.
- `origem: acervo|foto-propria` permite o agente dizer "gerar aqui seria errado" (rosto real, produto do cliente, print).
- `carousel-image.ts`: a **cena** nasce na skill, o **prompt final** é montado pelo daemon (direção de marca + negativos + formato). É a cerca da Camada 6 — sem ela, a string que chega ao provider seria 100% saída de LLM derivada de insumo do usuário. A cena entra delimitada, como dado citado.

---

## 4. Como foi verificado

Regra adotada depois de errar o diagnóstico duas vezes: **nenhuma fatia visual fecha sem render real comparando as duas marcas**.

- Mesmo `slides.json` renderizado em `root` e `fullbpo`, comparando o CSS resolvido no HTML.
- Prova de que a Root não muda: `--SCRIM` resolve para o gradiente antigo idêntico; tokens de forma não são emitidos e caem no fallback.
- Prova de que a FullBPO muda: `SCRIM=none`, `DT=#111111` (a cor dela, enfim viva), `R-CARD=2px`, `BAR-H=0`.
- Âncora de paridade byte a byte do pack Root: verde nas 3 regenerações.
- 67 testes passando, incluindo 5 novos da cerca de prompt de imagem.

**Dois bugs meus pegos pela verificação**, não pelo typecheck: divisão por 255 a mais no cálculo de luminância (fazia `#ffffff` contar como escuro) e dois testes pré-existentes que contavam `class="slide ` no arquivo inteiro — incluindo o CSS inline da marca ativa, o que os quebrava quando um comentário de skin continha markup de exemplo.

---

## 5. Pendências

### Decisão de produto
- **Geração de imagem não foi ligada.** O gateway já existe e é completo (`/api/projects/:id/media/generate`, 18 modelos, BYOK por provider — o que a ADR-005 exige). Falta decidir o fluxo de UX: em que momento o usuário vê a sugestão e aciona a geração, e onde a imagem gerada é persistida.
- **Densidade (padding/espaçamento) ficou fora dos tokens de forma**, deliberadamente. Mexer em espaçamento num canvas fixo é convite a overflow silencioso, e overflow não aparece em teste de CSS — aparece no PNG entregue ao cliente. Depende de existir teste de render.

### Segurança (bloqueante antes do primeiro cliente)
- **`/api/chat` não exige autenticação em loopback** e dispara o Claude Code com `--permission-mode bypassPermissions`. Qualquer processo local — extensão de navegador, script, outro agente — pode fazer o daemon rodar um agente com aprovação automática, na sessão e nos tokens do usuário. Só 3 rotas de import/export checam `desktopAuthSecret`; o mecanismo existe (`OD_REQUIRE_DESKTOP_AUTH=1`) e não está aplicado ao resto. **Fase 4, antes de qualquer distribuição.**

### Dívida conhecida
- **`--LT` do pack Root local** (`~/.maquina-carrossel/marcas/root/`) passou a resolver `#DFFFE8` em vez de `#F5F7FA`, porque a cópia local não tem o token explícito que o pack **empacotado** ganhou. A âncora de paridade testa o empacotado e está verde; o cromo dos decks locais da Root muda levemente.
- **Metodologia duplicada**: os 6 arquivos de `knowledge/` existem idênticos na V02. Decisão de 20/07: **a skill `carrossel-root` é a fonte da verdade**; vault do Obsidian e V02 são referência histórica. A V02 ainda não foi marcada como congelada.
- **Material do Obsidian não portado**: `Cerebro-Conteudo` tem mapeamento AIDA por slide, padrões por posição, o limite de 8 slides por queda de retenção e 310 linhas de metodologia de headline que a skill ainda não absorveu.

### Armadilha operacional
- **Nunca editar skill pelo lápis do painel.** Ele cria uma cópia sombra em `.od/skills/` que passa a rodar no lugar da versionada em git, sem aviso — o `git pull` deixa de atualizar a metodologia e ninguém percebe.
