# 08 — Layout do Claude Code (setup enxuto de criação de conteúdo)

> Decisão de 12/07/2026. O Claude Code carregava 22 plugins, ~10 conectores claude.ai e centenas de skills/agents — quase tudo irrelevante para criar conteúdo. Este doc registra o layout mínimo da Operação Root, como ele é imposto e como replicar/reverter.

## O que fica ativo neste projeto

| Categoria | Item | Origem |
|---|---|---|
| Comandos | `/carrossel`, `/marca`, `/setup` | plugin `maquina-carrossel` (local-first, sem API externa) |
| Skills nativas | dataviz, deep-research, code-review, verify, run etc. | harness do Claude Code (não removíveis; pouco ruído) |
| Agents | Explore, Plan, general-purpose, claude-code-guide | nativos |
| MCP | `palmier-pro` (127.0.0.1:19789) | editor Root (fork Open Design) |

## O que foi desativado e por quê

| O quê | Escopo | Onde | Por quê |
|---|---|---|---|
| 19 plugins `@claude-for-financial-services` (financial-analysis, investment-banking, equity-research, private-equity, wealth-management, lseg, sp-global…) | **Global** (Mac inteiro) | `~/.claude/settings.json` → `enabledPlugins: false` | Banco de investimento americano — sem uso na operação. Continuam instalados. |
| `fullbpo` (58 agents contábeis + MCP Omie) e `obsidian` | **Só este projeto** | `.claude/settings.json` deste repo → `enabledPlugins: false` | Essenciais na FullBPO, ruído na criação de conteúdo. Seguem ativos nos outros diretórios. |
| Conectores claude.ai (Gmail, Drive, Calendar, ClickUp, monday, Postman, Supabase, Vercel, n8n, Canva) | **Só este projeto** | `.claude/settings.json` → `disableClaudeAiConnectors: true` | Pipeline do carrossel é 100% local (princípio local-first da V03). Nada é desconectado da conta. |
| Comando `design-sync` (vault Hermes) | **Só este projeto** | `.claude/settings.json` → `skillOverrides` | Isolamento Hermes × Root — a Root não consome nada do vault Hermes. |
| Marketplace morto `maquina-conteudo` + grants órfãos | Global | `~/.claude/settings.json` (removidos) | Plugin já estava desabilitado; sobras de config. |

## Como replicar numa máquina nova (usuário final)

1. Instalar o plugin do carrossel: `/plugin marketplace add pedromagnago/maquina-carrossel` → `/plugin install maquina-carrossel`.
2. Rodar `/setup` (instala Node deps, Chromium do render e fontes; cria `~/.maquina-carrossel/`).
3. Clonar este repo — o `.claude/settings.json` já vem com o layout enxuto (entradas de plugins que a máquina não tem são ignoradas sem erro).
4. Rodar `/marca` para cadastrar a marca do cliente e `/carrossel` para produzir.

## Como reverter

- **Plugin financeiro de volta:** trocar `false` → `true` na entrada correspondente em `~/.claude/settings.json`, ou via `/plugin`.
- **fullbpo/obsidian neste projeto:** remover a entrada (ou `true`) no `.claude/settings.json` do repo.
- **Conectores claude.ai neste projeto:** remover a chave `disableClaudeAiConnectors`.
- Mudanças de settings valem para **sessões novas** — reinicie a sessão após editar.
