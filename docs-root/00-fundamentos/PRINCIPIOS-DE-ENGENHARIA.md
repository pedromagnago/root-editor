# Princípios de Engenharia

> Referência técnica transversal. Vale para qualquer projeto, independente de domínio ou stack. Escrito para ser lido por um engenheiro e por um agente de código. Não é teoria acadêmica — é o conjunto de decisões que separam código que envelhece bem de código que vira dívida.

---

## 1. A regra de dependência (o princípio que organiza tudo)

A decisão mais importante de qualquer sistema não é qual framework usar — é **para onde apontam as dependências**. Na Clean Architecture, a regra é uma só: **as dependências apontam para dentro, em direção à lógica de negócio**. O núcleo nunca importa nada das bordas.

```
        ┌──────────────────────────────────────┐
        │   Frameworks & Drivers (mais externo) │  banco, HTTP, UI, libs
        │   ┌──────────────────────────────┐    │
        │   │   Adaptadores de interface    │    │  controllers, gateways, repos
        │   │   ┌──────────────────────┐    │    │
        │   │   │   Casos de uso        │    │    │  regras da aplicação
        │   │   │   ┌──────────────┐    │    │    │
        │   │   │   │  Entidades    │    │    │    │  regra de negócio pura
        │   │   │   └──────────────┘    │    │    │
        │   │   └──────────────────────┘    │    │
        │   └──────────────────────────────┘    │
        └──────────────────────────────────────┘
                  dependências apontam ⟶ para dentro
```

- **Entidades** — a regra de negócio que existiria mesmo sem software. Não conhece banco, HTTP nem UI.
- **Casos de uso** — orquestram entidades para realizar uma intenção do usuário ("registrar pedido", "calcular elegibilidade"). Conhecem entidades, não conhecem o mundo externo.
- **Adaptadores** — traduzem entre o mundo externo e os casos de uso (controllers, repositórios, gateways de API).
- **Frameworks & drivers** — o detalhe substituível: o banco específico, a biblioteca de UI, o cliente HTTP.

**Teste prático:** se trocar o banco de dados ou a biblioteca de interface quebra a regra de negócio, a dependência está apontando para o lado errado. A regra de negócio deve ser a coisa **mais estável e mais ignorante** sobre tecnologia no sistema inteiro.

**Por que isso importa na prática:** facilita teste (você testa o núcleo sem subir banco), facilita troca de tecnologia (o detalhe externo é plugável) e isola o impacto de mudanças (mexer na borda não propaga para o centro).

---

## 2. SOLID, aplicado de forma pragmática

SOLID opera no nível de classe/módulo. Não é dogma — é um conjunto de heurísticas para decidir onde colocar o quê.

### S — Responsabilidade única
Um módulo deve ter **uma única razão para mudar**. O problema clássico não é "o arquivo é grande", é "código de que atores diferentes dependem está colado no mesmo lugar". Separe o que muda por motivos diferentes.
> *Cheiro:* uma função que valida, persiste e notifica ao mesmo tempo. Três motivos para mudar, três responsabilidades.

### O — Aberto/Fechado
O comportamento do sistema deve mudar **adicionando código novo, não alterando código existente**. Alcançado via abstração e composição.
> *Na prática:* em vez de um `switch` gigante que cresce a cada novo tipo, defina uma interface e adicione implementações.

### L — Substituição de Liskov
Partes intercambiáveis respeitam um contrato e podem ser trocadas **sem o consumidor precisar saber qual implementação está usando**.
> *Cheiro:* uma subclasse que lança exceção em um método que a superclasse promete cumprir. Quebra o contrato.

### I — Segregação de interface
**Não dependa do que você não usa.** Interfaces pequenas e focadas, não uma interface-monstro que força implementações a cumprir métodos irrelevantes.

### D — Inversão de dependência
Módulos de alto nível não dependem de módulos de baixo nível; **ambos dependem de abstrações**. A abstração é definida pelo módulo de alto nível (que dita o contrato), e o de baixo nível a implementa. É o mecanismo que torna a regra de dependência da seção 1 possível.

> **Equivalente funcional (para código não-OO):** SRP → funções puras com propósito único; OCP → funções de alta ordem e composição; DIP → injetar dependências como parâmetros, não importá-las direto.

---

## 3. Lógica de programação: padrões que evitam dívida

### 3.1 Falhe cedo, valide nas fronteiras
Valide a entrada no ponto em que ela cruza para dentro do sistema (controller, handler, borda do caso de uso). Uma vez dentro, o dado é confiável e o núcleo não fica poluído de checagens defensivas.

```
entrada externa → [validação na borda] → dado confiável no núcleo → [validação na saída] → mundo externo
```

### 3.2 Torne estados impossíveis irrepresentáveis
Modele os dados de forma que estados inválidos não compilem ou não construam. Um pedido não pode estar simultaneamente "pago" e "sem método de pagamento" — então não dê ao tipo a possibilidade de representar isso. Prefira uniões discriminadas / enums a flags booleanas soltas que se contradizem.

### 3.3 Funções pequenas, com um nível de abstração
Uma função deve operar em um único nível de abstração. Misturar "calcular imposto" com "abrir conexão de socket" na mesma função é sinal de que há duas funções ali. Nome da função descreve a intenção, não a implementação.

### 3.4 Erros são valores, não surpresas
Decida explicitamente a estratégia de erro e use-a em todo o sistema:
- **Erros esperados** (input inválido, recurso não encontrado) → retorne um resultado tipado, não lance exceção.
- **Erros excepcionais** (banco caiu, invariante violada) → falhe ruidosamente, registre, e deixe a borda tratar.
Nunca engula erro silenciosamente. Um `catch` vazio é uma bomba-relógio.

### 3.5 Imutabilidade por padrão
Dados que não precisam mudar não devem poder mudar. Reduz a superfície de bugs de estado compartilhado. Mutação é uma decisão consciente, não o padrão.

### 3.6 Princípio da menor surpresa
Código deve fazer o que o nome promete e nada mais. Uma função chamada `getUser` não deve gravar no banco. Efeitos colaterais escondidos são a principal fonte de bugs caros.

### 3.7 DRY com discernimento
Elimine duplicação de **conhecimento**, não de aparência. Dois trechos parecidos que mudam por motivos diferentes **não** são duplicação — uni-los cria acoplamento falso. Duplicação prematuramente abstraída é pior que duplicação.

---

## 4. Estrutura e nomenclatura

- **Organize por funcionalidade, não por tipo técnico.** `pedidos/` contendo seu caso de uso, repositório e tipos é melhor que `controllers/`, `services/`, `models/` espalhando uma feature por três pastas.
- **Nomes revelam intenção.** `diasAteVencimento` é melhor que `d`. O custo de digitar é pago uma vez; o custo de decifrar, toda leitura.
- **Consistência > preferência pessoal.** Escolha uma convenção (camelCase para funções, PascalCase para tipos/componentes) e aplique sem exceção. A consistência é o que torna o código previsível.
- **Booleanos afirmam.** `isAtivo`, `temPermissao` — não `naoInativo`.

---

## 5. Testes: a rede que permite velocidade

Testabilidade não é um luxo — é consequência de boa arquitetura. Se algo é difícil de testar, normalmente está mal desenhado (acoplado demais, fazendo coisas demais).

- **Pirâmide de testes:** muitos testes de unidade (rápidos, no núcleo), alguns de integração (nas fronteiras), poucos de ponta a ponta (no fluxo crítico do usuário).
- **Teste comportamento, não implementação.** Um teste que quebra quando você refatora sem mudar comportamento é um teste ruim.
- **O núcleo de negócio se testa sem infraestrutura.** Se você precisa subir o banco para testar uma regra de cálculo, a regra está acoplada ao banco — volte à seção 1.
- **Cada bug corrigido vira um teste.** Garante que ele não volta.

---

## 6. Trabalhando com agentes de código (específico de IA)

O agente de código é uma ferramenta poderosa e literal. Ele rende melhor sob restrições claras.

- **Contexto fixo + uma fase por vez.** Forneça princípios, constraints e arquitetura como contexto estável; peça uma fase do PRD de cada vez. Não despeje o sistema inteiro.
- **Restrições legíveis por máquina.** "Nunca gere componente fora do design system" vale mais que um parágrafo explicando filosofia.
- **Revisão humana é obrigatória.** O agente acelera a escrita; não substitui o julgamento. Trate o output como PR de um júnior brilhante mas desatento: leia tudo antes de aceitar.
- **Peça que ele pare em vez de improvisar.** Instrua explicitamente: em dúvida sobre schema, dependência nova ou regra de negócio, perguntar antes de assumir.

---

## 7. ADR — registrando decisões

Toda decisão estrutural relevante vira um **Architecture Decision Record** de uma página. Formato mínimo:

```
# ADR-NNN: [título da decisão]
Data: AAAA-MM-DD · Status: aceito | substituído por ADR-XXX

## Contexto
Qual problema/força nos levou a decidir isto.

## Decisão
O que foi decidido, em uma ou duas frases.

## Consequências
O que ganhamos, o que abrimos mão, o que fica mais difícil.
```

ADRs são o que permite, seis meses depois, entender **por que** algo foi feito daquele jeito — e decidir com segurança se ainda faz sentido.

---

## Referências
- Martin, R. C. — *Clean Architecture* e *Clean Code* (regra de dependência, SOLID, código limpo)
- TechTarget — *A primer on the clean architecture pattern and its principles*
- serodriguez68 — *Clean Architecture: Design Principles* — github.com/serodriguez68/clean-architecture
- Santana, E. — *SOLID Principles: Foundation for Clean Code* — ersantana.com (inclui adaptação para programação funcional)
