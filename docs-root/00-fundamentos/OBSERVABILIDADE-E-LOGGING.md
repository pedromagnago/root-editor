# Observabilidade e Logging Escalonado

> Pré-requisito geral de todo projeto. Sem logging estruturado você está depurando no escuro: o sistema é uma caixa-preta e cada bug vira investigação arqueológica. Com ele, você lê o que aconteceu como se fosse o gravador de voo de um avião. Este documento define **como logar**, **o que logar** e **o que nunca logar**.

---

## 1. Por que logging estruturado (e não `print`)

Log em texto livre (`"Pedido 123 falhou no pagamento"`) é legível por humano, mas inútil em escala: não dá para filtrar, agrupar nem alertar sem regex frágil. **Logging estruturado** transforma cada evento em um objeto de dados (tipicamente JSON) com campos definidos — pesquisável, filtrável e correlacionável por ferramentas.

A regra: **cada log é um evento com contexto, não uma frase.**

```json
{
  "timestamp": "2026-06-06T14:30:00Z",
  "level": "error",
  "service": "modulo-pagamento",
  "event": "pagamento_falhou",
  "request_id": "req_789",
  "trace_id": "abc-123-def",
  "user_id": "u_456",
  "latency_ms": 145,
  "message": "Gateway retornou timeout"
}
```

Times que implementam correlação por `trace_id`/`request_id` relatam economia expressiva no tempo de depuração, porque conseguem reconstruir a jornada inteira de uma requisição através do sistema a partir de um único identificador.

---

## 2. Os níveis de log (a "escalada")

A escalada de severidade é o que permite separar sinal de ruído. Cada nível tem um propósito específico; usá-los de forma disciplinada é o que torna o log útil sob pressão.

| Nível | Quando usar | Vai para produção? |
|-------|-------------|--------------------|
| **DEBUG** | Detalhe interno para o desenvolvedor: valores de variáveis, entrada/saída de função, passos de um cálculo. Ruidoso por natureza. | Não (ou amostrado a 1%) |
| **INFO** | Operação normal e marcos de negócio: "usuário autenticou", "pedido criado", "job concluído". | Sim |
| **WARN** | Algo inesperado mas recuperável: retry acionado, fallback usado, limite se aproximando, input degradado. Não quebrou — ainda. | Sim, com atenção |
| **ERROR** | Uma operação falhou e exige ação: exceção não tratada, falha de integração, invariante violada. | Sim, com alerta |
| **FATAL/CRITICAL** | O sistema (ou um subsistema essencial) não consegue continuar. Acorda gente de madrugada. | Sim, alerta máximo |

**Heurística prática:** se você vai querer um alerta automático, é WARN ou acima. Se é só para entender o fluxo durante desenvolvimento, é DEBUG. INFO é a narrativa do que o sistema faz de normal.

**Regra de ruído:** excesso de DEBUG/INFO em produção infla custo de armazenamento e *esconde* os eventos importantes no meio do barulho. Logar demais é tão ruim quanto logar de menos.

---

## 3. Configuração por ambiente

O comportamento do log muda conforme o ambiente. Em desenvolvimento você quer tudo, formatado para leitura humana; em produção você quer JSON, nível INFO, e amostragem do DEBUG.

```typescript
// config/logging.ts
interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'pretty' | 'json';
  includeStackTrace: boolean;
  sampleRate: number; // 0..1 — fração de logs DEBUG mantidos
}

const configs: Record<string, LogConfig> = {
  development: { level: 'debug', format: 'pretty', includeStackTrace: true,  sampleRate: 1.0  },
  staging:     { level: 'debug', format: 'json',   includeStackTrace: true,  sampleRate: 0.1  },
  production:  { level: 'info',  format: 'json',   includeStackTrace: false, sampleRate: 0.01 },
};

export const logConfig = configs[process.env.NODE_ENV ?? 'development'];
```

> Nota de segurança: stack traces em produção podem vazar detalhes internos — por isso `includeStackTrace: false` lá, com o erro completo indo para um destino seguro de erros, não para o log geral.

---

## 4. Campos obrigatórios (o schema)

Defina o schema **uma vez** e aplique em todo o sistema. Consistência de campos é o que torna dashboards, filtros e alertas possíveis. Campos mínimos em todo evento:

- `timestamp` — ISO 8601 em UTC, sempre.
- `level` — o nível da escalada.
- `service` / `module` — de onde veio.
- `event` — nome do evento em formato estável (`pagamento_falhou`, não uma frase variável).
- `message` — descrição legível para humano.
- `request_id` — identifica uma requisição única.
- `trace_id` — correlaciona a requisição através de múltiplos serviços/etapas.
- Contexto relevante — `user_id`, `tenant_id`, `latency_ms`, `status_code`, etc.

**Por que `event` separado de `message`:** o `event` é a chave estável que você agrupa e conta ("quantos `pagamento_falhou` na última hora?"); a `message` é o texto livre que ajuda o humano a entender o caso específico.

---

## 5. O que NUNCA logar

Logs estruturados são fáceis de pesquisar — o que torna dados sensíveis expostos ainda mais perigosos. **Nunca** registre:

- Senhas, tokens de autenticação, chaves de API, segredos.
- Dados de cartão, documentos de identidade, dados pessoais sensíveis (PII).
- Conteúdo completo de payloads que possam conter os itens acima.

Quando precisar referenciar uma entidade sensível, logue um **identificador** (`user_id`), não o dado em si. Aplique mascaramento/redação na borda de logging, não confie em "lembrar de não logar".

---

## 6. Logging em fluxos com IA (específico)

Componentes de IA precisam de logging extra porque seu comportamento é não-determinístico e você precisa de rastro para auditar e depurar:

- **Logue a fronteira, não o miolo sensível:** registre que houve uma chamada ao modelo, latência, tokens usados, modelo/versão, e um `trace_id` — mas trate o conteúdo do prompt como potencialmente sensível (ver seção 5).
- **Registre decisões de moderação/validação:** quando a validação de entrada ou saída barra algo, logue o evento (`input_rejeitado`, `output_invalido`) para auditoria e para detectar tentativas de abuso (ex.: prompt injection).
- **Correlacione a jornada inteira:** do clique do usuário → validação → chamada ao modelo → gravação, tudo sob o mesmo `trace_id`. É isso que permite responder "por que a IA fez X naquele caso?".
- **Meça custo e latência:** `tokens_in`, `tokens_out`, `latency_ms`, `model` — campos que viram dashboard de custo e performance.

---

## 7. Centralização (quando o projeto cresce)

Logs espalhados por servidores perdem valor. Quando o sistema cresce, agregue tudo em um só lugar pesquisável (stacks como ELK/Elasticsearch, Loki + Grafana, ou logging nativo da nuvem). O log estruturado em JSON é justamente o que torna essa ingestão trivial. Configure alertas sobre níveis: ignore DEBUG/INFO, alerte em WARN/ERROR/FATAL.

---

## 8. Checklist de logging do projeto

- [ ] Formato estruturado (JSON) definido e aplicado em todo o código
- [ ] Schema de campos obrigatórios documentado e seguido
- [ ] Níveis usados com disciplina (DEBUG/INFO/WARN/ERROR/FATAL)
- [ ] Configuração por ambiente (dev/staging/prod) implementada
- [ ] `trace_id`/`request_id` propagado por toda a jornada
- [ ] Redação de dados sensíveis ativa na borda de logging
- [ ] Eventos de IA (chamadas, validações, custo) instrumentados
- [ ] Alertas configurados sobre WARN+ em produção

---

## Referências
- SigNoz — *What Is Structured Logging? Examples, Benefits, and Best Practices* — signoz.io/blog/structured-logs
- Uptrace — *Structured Logging: Best Practices & JSON Examples* — uptrace.dev/glossary/structured-logging (correlação por trace_id e economia de tempo de depuração)
- OneUptime — *How to Implement Structured Logging Best Practices* — oneuptime.com (configuração por ambiente)
- Middleware — *Understanding Log Levels for Better Observability* — middleware.io/blog/log-levels-guide
