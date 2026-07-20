# Disciplina de Commits e Versionamento

> Pré-requisito geral de todo projeto. O histórico de commits não é burocracia — é a documentação viva do *porquê* das mudanças e a sua rede de segurança para reverter com confiança. Commits bem feitos aceleram o desenvolvimento (revisão mais rápida, menos retrabalho) e elevam a qualidade (cada mudança é isolada, testável e reversível). Esta é a diferença, segundo a literatura de engenharia, entre o histórico que parece "um bilhete de sequestro" e um que conta uma narrativa legível.

---

## 1. Os dois princípios que sustentam tudo

A disciplina de commits se apoia em duas ideias complementares:

1. **Commit atômico** — define *como fatiar* o trabalho: um commit = uma intenção, uma mudança coerente e testável.
2. **Commit convencional (semântico)** — define *como nomear* cada fatia: um formato padronizado, legível por humano e por máquina.

Juntos, transformam o histórico em algo com mudanças reversíveis, changelogs úteis, revisões mais rápidas e menos momentos de "o que eu fiz aqui há seis meses?".

---

## 2. Commit atômico — a periodicidade certa

**Um commit atômico representa uma única intenção e uma mudança coerente, autocontida e testável.** Não é sobre fragmentar em pedaços microscópicos — é sobre cada commit ser:

- **Revisável sozinho:** quem revisa entende a intenção sem caçar mudanças não relacionadas.
- **Reversível com segurança:** se você desfizer o commit, o projeto continua estável.
- **Coerente:** uma área, uma intenção.

**O teste do "também":** ao descrever o commit, se a frase precisa da palavra *"também"* ("corrige o login **e também** atualiza o rodapé"), você provavelmente precisa de dois commits.

### Quando commitar (periodicidade prática)
- Assim que uma unidade lógica de trabalho está completa e o projeto continua em estado consistente — não a cada linha, nem só no fim do dia.
- Antes de trocar de contexto/tarefa.
- Antes de um refactor arriscado (para ter um ponto de retorno limpo).
- **Nunca** acumule um dia inteiro de mudanças heterogêneas em um commit "WIP" gigante.

> Ferramenta útil: `git add -p` (modo patch) permite encenar apenas os trechos relacionados a uma única intenção, ajudando a manter commits atômicos mesmo quando você mexeu em várias coisas.

---

## 3. Commit convencional — o conteúdo certo

Formato da especificação Conventional Commits:

```
tipo(escopo opcional): assunto no imperativo, até ~50 caracteres

corpo opcional, explicando o PORQUÊ (não o quê), quebrado em ~72 colunas

rodapé opcional
BREAKING CHANGE: descrição, se houver
Refs: #123
```

### Tipos principais
| Tipo | Uso | Efeito em versão (SemVer) |
|------|-----|---------------------------|
| `feat` | nova funcionalidade | MINOR (1.0.0 → 1.1.0) |
| `fix` | correção de bug | PATCH (1.0.0 → 1.0.1) |
| `docs` | só documentação | nenhum |
| `refactor` | mudança que não altera comportamento | nenhum |
| `test` | adição/correção de testes | nenhum |
| `chore` | manutenção, build, deps | nenhum |
| `perf` | melhoria de performance | PATCH |
| `style` | formatação, sem efeito em lógica | nenhum |

`!` após o tipo ou `BREAKING CHANGE:` no rodapé → versão MAJOR (1.0.0 → 2.0.0).

### Exemplos bons
```
feat(auth): adiciona suporte a JWT no endpoint de login
fix(ui): evita crash no mobile quando o menu está fechado
refactor(core): simplifica pipeline de dados com async/await
docs: atualiza README com instruções de setup
```

### O assunto
- **Imperativo, presente:** "adiciona", não "adicionado" nem "adicionando".
- **Conciso e específico:** "corrige cálculo de juros em parcelas atrasadas", não "corrige bug".
- O corpo explica o **porquê** e o **impacto** — o código já mostra o *quê*.

---

## 4. Por que isso acelera E qualifica o desenvolvimento

Não é trade-off entre velocidade e qualidade — a disciplina entrega os dois:

- **Velocidade:** commits pequenos e bem nomeados são revisados em minutos, não horas. `git bisect` encontra a origem de um bug em passos logarítmicos quando cada commit é coerente. Reverter é cirúrgico.
- **Qualidade:** escrever commits convencionais empurra você naturalmente a fazer mudanças pequenas e incrementais, cada uma com propósito único — o que reduz a chance de introduzir bugs e facilita o teste isolado.
- **Automação:** ferramentas leem o histórico convencional e geram changelog e a próxima versão automaticamente — `fix` é patch, `feat` é minor, breaking change é major. Sem adivinhação, sem debate.

---

## 5. Ramificação e a branch principal

- **`main` sempre implantável.** Nada que quebra entra na principal. O que está em `main` poderia ir para produção a qualquer momento.
- **Branches de funcionalidade** curtas e focadas, integradas com frequência para evitar divergência grande e dolorosa.
- **Revisão antes do merge.** Mesmo trabalhando sozinho, abrir o diff e reler o conjunto pega metade dos erros bobos.

---

## 6. Tags e versionamento semântico (SemVer)

Marque releases com SemVer (`MAJOR.MINOR.PATCH`):
- **MAJOR** — mudança incompatível (quebra contrato).
- **MINOR** — funcionalidade nova compatível.
- **PATCH** — correção compatível.
- Pré-releases com sufixo: `2.0.0-beta.1` para indicar que ainda não é estável.

Como os commits convencionais já carregam essa informação, a tag de versão pode ser derivada deles — manual ou automaticamente.

---

## 7. Segurança e o `.gitignore`

- **Nunca commite segredos.** Chaves, tokens, `.env`, credenciais — entram no `.gitignore` antes do primeiro commit. Um segredo commitado fica no histórico para sempre, mesmo que removido depois.
- **`.gitignore` desde o início:** dependências (`node_modules/`), artefatos de build, arquivos de ambiente, logs locais.
- Se um segredo vazar no histórico, trate como comprometido: rotacione a credencial imediatamente — remover o commit não basta.

---

## 8. Commits em fluxo com agente de código (específico de IA)

Quando um agente gera código, a disciplina de commit é a sua rede de segurança:

- **Commit antes de aceitar uma geração grande.** Ter um ponto limpo de retorno antes de o agente mexer em muitos arquivos permite reverter sem dor.
- **Um commit por fase do PRD.** Casa com o faseamento da metodologia: cada fase entregue vira um conjunto coerente e reversível.
- **Revise o diff do agente como um PR.** O commit isola exatamente o que mudou; leia tudo antes de confirmar.
- **Não deixe o agente acumular mudanças não relacionadas.** Instrua-o a manter a mudança atômica e a parar para commit ao concluir cada unidade lógica.

---

## 9. Checklist de commit do projeto

- [ ] `.gitignore` configurado antes do primeiro commit (segredos, env, deps, build)
- [ ] Conventional Commits adotado (`tipo(escopo): assunto`)
- [ ] Commits atômicos — passam no "teste do também"
- [ ] Assunto no imperativo, ≤ ~50 caracteres; corpo explica o porquê
- [ ] `main` mantida sempre implantável
- [ ] Revisão de diff antes de cada merge
- [ ] Releases marcadas com SemVer
- [ ] Nenhum segredo no histórico

---

## Referências
- Conventional Commits — especificação oficial — conventionalcommits.org
- Jourdan, N. — *Atomic Commits & Conventional Commits: The missing discipline in your Git Workflow* — medium (jan/2026)
- Nuri, M. — *Conventional Commits: A Complete Guide to Better Git Commit Messages* — blog.marcnuri.com (atualizado 2026)
- Pull Checklist — *Git Commit Best Practices: 7 Proven Tips* — pullchecklist.com (atômico + convencional + SemVer)
- Dessign — *8 Essential Git Best Practices for Dev Teams* — dessign.net (main implantável, .gitignore, tags)
