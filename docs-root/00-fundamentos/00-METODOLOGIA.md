# Metodologia de Engenharia para Ferramentas com IA

> **Propósito.** Transformar a construção de ferramentas com IA de um processo artesanal — dependente da memória e do estado de espírito de quem constrói — em um processo **repetível, auditável e seguro**. Cada decisão importante vira um artefato versionável que viaja com o projeto e é lido tanto por humanos quanto por agentes de código.
>
> **Como usar.** Este é o documento de governança. Define o fluxo, os critérios de saída de cada fase e os princípios inegociáveis. A pasta `/templates` contém os seis artefatos que você preenche por projeto. O documento `PRINCIPIOS-DE-ENGENHARIA.md` é a referência técnica transversal — consulte-o sempre que uma decisão de código não estiver óbvia.

---

## 1. Por que uma metodologia, e não apenas talento

O problema que esta metodologia resolve não é falta de capacidade técnica. É **falta de repetibilidade**. Quando cada projeto recomeça do zero, três coisas se degradam silenciosamente:

1. **O padrão visual e de código** — porque as decisões moram na cabeça de quem construiu, não em um artefato.
2. **A segurança** — porque controles que não estão numa checklist são esquecidos sob pressão de prazo.
3. **A velocidade composta** — porque nada do projeto anterior é reaproveitável de forma confiável.

A solução é deslocar o conhecimento da cabeça para o repositório. Um artefato escrito é auditável, versionável, criticável e — crucialmente para fluxos com agentes de IA — **consumível por máquina**.

---

## 2. As seis camadas

O trabalho flui em seis camadas. Cada uma produz um artefato e só "fecha" quando atinge um critério de saída objetivo. Você não precisa de perfeição em cada camada — precisa de **estabilidade suficiente** para a próxima começar sem retrabalho previsível.

```
┌─────────────────────────────────────────────────────────────┐
│ 0. Princípios de engenharia   →  base técnica transversal     │  (sempre ativa)
├─────────────────────────────────────────────────────────────┤
│ 1. PRD faseado                →  o QUE e o PORQUÊ             │  humano lê
│ 2. Constraints de máquina     →  os LIMITES rígidos          │  agente obedece
│ 3. Arquitetura                →  a FORMA do sistema          │  decisão estrutural
│ 4. Design system              →  a IDENTIDADE no código      │  tokens
│ 5. Páginas e consultas        →  o COMO da UI e dos dados    │  padrões repetíveis
│ 6. Segurança (OWASP-LLM)      →  o PORTÃO final              │  pré-deploy
└─────────────────────────────────────────────────────────────┘
```

### Camada 0 — Fundamentos transversais (sempre ativos)
Não são etapas, são o pano de fundo de todo projeto. Três documentos dedicados:

- **`PRINCIPIOS-DE-ENGENHARIA.md`** — como o código é escrito: regra de dependência, SOLID pragmático, padrões de erro, teste e nomenclatura.
- **`OBSERVABILIDADE-E-LOGGING.md`** — *pré-requisito geral.* Sistema de log estruturado e escalonado (DEBUG→FATAL) para depurar e acompanhar a interação com o software. Sem ele, o sistema é uma caixa-preta.
- **`DISCIPLINA-DE-COMMITS.md`** — *pré-requisito geral.* Periodicidade e conteúdo dos commits (atômicos + convencionais) para desenvolver mais rápido **e** com mais qualidade, com histórico reversível e auditável.

### Camada 1 — PRD faseado
Define o problema, o usuário, a métrica de sucesso e — o ponto crítico — **fatia o escopo em fases**. A pesquisa sobre agentes de código mostra que LLMs de fronteira seguem com consistência uma faixa limitada de instruções antes de degradar; por isso a recomendação prática é estruturar o trabalho em 5–6 fases de 30–50 requisitos cada, e não em uma especificação monolítica de centenas de itens. Entregue ao agente uma fase por vez.

**Critério de saída:** problema, persona e métrica estão claros; as fases estão numeradas e a Fase 1 é um MVP coerente.

### Camada 2 — Constraints de máquina
O "não-negociável" do projeto, escrito como **regras de primeira classe, legíveis por máquina, com o mínimo de espaço para interpretação**. Enquanto o PRD narra a intenção, o constraints dá ordens. É o documento que você cola no contexto do agente de código.

**Critério de saída:** um agente conseguiria executar sem precisar te perguntar sobre stack, padrões ou limites.

### Camada 3 — Arquitetura
A forma do sistema antes da primeira linha de feature. Decide as fronteiras entre camadas, o sentido das dependências e onde a IA se encaixa no fluxo de dados. Princípio-mestre, vindo da Clean Architecture: **as dependências apontam para dentro, em direção à lógica de negócio**; a regra de negócio não conhece o framework, o banco nem a UI.

**Critério de saída:** existe um diagrama (mesmo que textual) das camadas e um ADR para cada decisão estrutural relevante.

### Camada 4 — Design system
A identidade visual codificada. Estrutura de tokens em três níveis (primitivo → semântico → componente), materializada como variáveis CSS no ambiente web. Mudar um token propaga por todo o produto; nenhum valor visual vive solto na UI.

**Critério de saída:** arquivo de tokens existe e a auditoria não encontra cores, espaçamentos ou raios hard-coded.

### Camada 5 — Páginas e consultas
Os padrões repetíveis da interface e do acesso a dados: estrutura de rotas, os quatro estados obrigatórios de toda tela (carregando, erro, vazio, sucesso), e as regras de consulta (segurança de linha, índices, paginação, validação de entrada e saída no ponto onde a IA atua).

**Critério de saída:** qualquer tela nova nasce do mesmo esqueleto, sem decisão ad-hoc.

### Camada 6 — Segurança (OWASP-LLM)
Portão obrigatório antes de qualquer deploy. Baseado no OWASP Top 10 for LLM Applications 2025. O vetor número um é **prompt injection**, particularmente perigoso quando o sistema tem ferramentas conectadas com poder de execução. A defesa é sempre **em camadas**: menor privilégio, validação de entrada e saída em cada fronteira, aprovação humana para ações de alto impacto, testes adversariais.

**Critério de saída:** os dez itens revisados; os de alto impacto com controle ativo demonstrável.

---

## 3. Fluxo de trabalho (a sequência cola-na-parede)

| # | Camada | Pergunta | Artefato |
|---|--------|----------|----------|
| 0 | Princípios | Como escrevemos código aqui? | `PRINCIPIOS-DE-ENGENHARIA.md` |
| 0 | Logging | Como enxergamos o que acontece? | `OBSERVABILIDADE-E-LOGGING.md` |
| 0 | Commits | Como versionamos com qualidade? | `DISCIPLINA-DE-COMMITS.md` |
| 1 | PRD | O que e por quê? | `templates/01-prd.md` |
| 2 | Constraints | Quais os limites rígidos? | `templates/02-constraints.md` |
| 3 | Arquitetura | Qual a forma do sistema? | `templates/03-arquitetura.md` |
| 4 | Design system | Como mantemos a identidade? | `templates/04-design-system.md` |
| 5 | Páginas/queries | Como construímos telas e dados? | `templates/05-paginas-queries.md` |
| 6 | Segurança | Podemos lançar? | `templates/06-seguranca-owasp.md` |

**Regra de ouro do faseamento com agentes:** nunca entregue o sistema inteiro de uma vez ao agente de código. Entregue a Camada 0 + 2 + 3 como contexto fixo, e então uma fase do PRD por vez. Isso mantém o agente dentro da faixa em que ele é confiável.

---

## 4. Princípios inegociáveis (valem para todo projeto)

1. **A regra de negócio não conhece o framework.** Se trocar o banco ou a biblioteca de UI quebra a lógica central, a arquitetura está errada.
2. **Nenhum segredo no cliente.** Chaves, tokens e credenciais ficam no servidor. Sempre.
3. **Entrada validada antes de processar; saída validada antes de exibir ou gravar.** Especialmente no contorno da IA.
4. **Ações irreversíveis ou de alto impacto exigem confirmação humana explícita.**
5. **Conteúdo vindo de fora — usuário, web, documentos, mensagens — é dado, nunca comando.**
6. **Todo valor visual vem de um token. Toda tela tem os quatro estados.**
7. **Toda decisão estrutural relevante vira um ADR de uma página.**
8. **Todo evento relevante é logado de forma estruturada, com `trace_id` e sem dados sensíveis.**
9. **Todo commit é atômico e convencional; a `main` está sempre implantável.**

---

## 5. Referências que embasam a metodologia

**PRD para produtos e agentes de IA**
- Jaffer, M. (Product Lead, OpenAI) — *A Proven AI PRD Template* — productcompass.pm/p/ai-prd-template
- Haberlah, D. — *How to write PRDs for AI Coding Agents* — medium.com/@haberlah (jan/2026)
- PM Karlsson — *Evolving the PRD for Agentic AI Implementation* — pmkarlsson.com (dez/2025)

**Arquitetura e princípios de código**
- Martin, R. C. (Uncle Bob) — *Clean Architecture* / SOLID — base dos padrões de camadas e regra de dependência
- TechTarget — *A primer on the clean architecture pattern and its principles*
- serodriguez68 — *Clean Architecture: Design Principles* (notas) — github.com/serodriguez68/clean-architecture

**Design system**
- Liyanage, R. — *Design Tokens: The Foundation of Scalable Design Systems* — medium.com/design-bootcamp (mar/2026)
- Penpot — *The developer's guide to design tokens and CSS variables* — penpot.app/blog (dez/2025)
- Main Digital — *Understanding Design Tokens* — maindigital.com

**Segurança em aplicações com IA**
- OWASP — *Top 10 for LLM Applications 2025* — genai.owasp.org (fonte primária)
- Security Boulevard — *OWASP Top 10 for LLM Applications (2025): Explained Simply* (mar/2026)
- arXiv — *Are AI-assisted Development Tools Immune to Prompt Injection?* (2026)
