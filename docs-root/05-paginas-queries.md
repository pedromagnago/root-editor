# Camada 5 — Telas e Acesso a Dados (Máquina de Carrossel V03)

> **v0.1.** Os padrões repetíveis da interface e do acesso a dados do **editor**. Qualquer tela nova nasce deste esqueleto.
>
> **Nota de contexto:** o editor é um app **desktop local-first, mono-usuário**. Por isso o capítulo de "consultas" do template (que assume web + banco multi-tenant) é **reinterpretado**, não copiado: não há segurança de linha por tenant nem SQL; há acesso a arquivos locais, à API de imagem do cliente e ao endpoint de licença. Os princípios (validar antes de chamar, menor privilégio, erro consistente, sem buscar coleção inteira) continuam valendo.

---

## 1. Telas

### Estrutura
- **Superfícies principais:** (1) **Abertura/Import** do `slides.json`; (2) **Canvas de edição** (a tela-mãe); (3) **Painel de imagem** (trocar/gerar); (4) **Exportação** (PNGs 1080×1350); (5) **Licença/Ativação**. Uma **Biblioteca de projetos** local é opcional (Fase 1 pode abrir 1 projeto por vez).
- **Layout base:** toolbar (topo) + canvas (centro) + painel de propriedades (lateral) — herdado do fork, reskinnado com `--ui-*`.
- **Organização de código:** uma pasta por funcionalidade (tela + lógica + tipos juntos), não por tipo técnico.

### Os 4 estados obrigatórios (toda tela, sem exceção)
- [ ] **Carregando** — skeleton/indicador. Ex.: importando `slides.json`, gerando imagem (pode levar segundos), exportando. Nunca tela branca travada.
- [ ] **Erro** — mensagem humana + retry. Ex.: `slides.json` inválido ("arquivo fora do contrato — verifique o schema"), API de imagem falhou, licença não validou. Logar (ERROR) com `trace_id`.
- [ ] **Vazio** — orienta o próximo passo. Ex.: nenhum projeto aberto → "importe um `slides.json` para começar"; nenhuma imagem no slide → "gere ou solte uma imagem".
- [ ] **Sucesso** — o conteúdo (canvas com os slides).

### Princípios de UI
- **Menor surpresa:** o componente faz o que o nome promete; sem efeito colateral escondido (ex.: "Gerar imagem" não sobrescreve a atual sem confirmar).
- **Feedback imediato:** toda ação tem resposta visível (loading/sucesso/erro).
- **Acessibilidade:** navegação por teclado, foco visível (`--ui-focus-ring`), contraste via tokens (Camada 4 §6).

## 2. Acesso a dados (reinterpretado p/ local-first)

O editor lida com **três fontes**, não um banco:

| Fonte | O que é | Regras |
|-------|---------|--------|
| **Arquivos locais** | `slides.json`, assets de imagem, PNGs exportados, estado do projeto | Ler/escrever só dentro do diretório de projeto/saída (não sair da sandbox). Validar `slides.json` contra o schema **antes** de carregar. |
| **API de imagem (chave do cliente)** | geração/edição de imagem | Chave fica local; validar prompt/params antes de chamar; nunca logar chave nem prompt sensível; tratar erro/limite da API como valor. |
| **Endpoint de licença (VPS Root)** | valida a licença | Read-only; resposta **assinada** pela VPS; cache offline de N dias; falha de rede → usa cache, não "libera geral". |

### Regras de acesso (segurança primeiro — adaptadas)
- [ ] **Menor privilégio:** o app acessa só o diretório de projeto e as APIs configuradas — nada além. (Segurança de linha/tenant **não se aplica**: mono-usuário local.)
- [ ] **Sandbox de arquivos:** caminhos validados; sem sobrescrever fora do diretório de saída.
- [ ] **Segredos fora do cliente:** o segredo de assinatura da licença mora só na VPS (nunca no binário).

### Performance
- [ ] **Sem "buscar tudo":** listas (assets, projetos, se houver) paginadas/virtualizadas — não renderizar coleção inteira sem limite.
- [ ] Operações pesadas (export, geração de imagem) **não bloqueiam a UI** (assíncrono + estado de loading).
- [ ] Evitar recomputar o documento inteiro a cada tecla (edição incremental).

### Padrão de chamada
- [ ] Validação da entrada **antes** de chamar (schema do `slides.json`; params de imagem; formato da chave de licença).
- [ ] Erro esperado = valor de retorno tipado; excepcional = ruidoso + log (Camada 2 §6). `catch` vazio proibido.
- [ ] Estado de loading conectado ao estado da tela.
- [ ] **Cache/revalidação:** licença cacheada localmente com TTL de N dias + revalidação no boot; assets de imagem cacheados por referência.

## 3. Onde a IA entra no fluxo de dados

Dois pontos (ver Camada 3 §2). Nesta camada, o ponto vivo na UI é a **geração de imagem**:

- [ ] **Ponto exato:** Painel de imagem → gateway de imagem → API do cliente.
- [ ] **Entrada validada/sanitizada antes** do modelo — tema/prompt tratados como **dado, não comando** (o texto do slide pode conter instrução maliciosa embutida → não vira comando).
- [ ] **Saída validada antes** de renderizar/gravar (imagem no formato/tamanho esperado; texto gerado sanitizado antes de virar nó no documento — sem HTML/script injetado).
- [ ] **Evento instrumentado** no log: chamada, latência, modelo/versão, resultado da validação, sob o `trace_id` (nunca a chave nem o prompt sensível).
- [ ] **Confirmação humana** para ação de alto impacto: sobrescrever imagem existente, exportar por cima de arquivos, aplicar geração em lote.

> O `slides.json` que vem da **fase de criação** (as skills executadas pelo Claude Code do cliente) também é "saída de IA": entra no editor **só depois** de validado contra o schema (Camada 6, LLM05).

## 4. Checklist de uma tela nova
- [ ] Segue o layout base (toolbar/canvas/painel) e usa só `--ui-*`
- [ ] 4 estados implementados
- [ ] Acesso a arquivo dentro da sandbox; entrada validada antes de I/O
- [ ] Chamada de IA com entrada/saída validadas e confirmação p/ alto impacto
- [ ] Erros logados com `trace_id`
- [ ] Nenhum valor visual hard-coded (só tokens do design system)
