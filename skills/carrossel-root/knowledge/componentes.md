# Biblioteca de Componentes (referência interna)

Componentes reutilizáveis do design system. O `redator`/`designer-render` escolhem qual usar por slide (campo `componentes[]` no `slides.json`); a implementação CSS vive em `render/components/`. Cores sempre via tokens da marca. **Regra:** no máximo ~3 elementos por slide; escolha o componente certo para o conteúdo, não empilhe.

## data-pill — número de impacto
Variações: `.danger` (`--ALERT`), `.success` (`--OK`), `.neutral` (`--P`).
```html
<div class="data-pill danger">
  <span class="number">51%</span>
  <span class="label">ao ano em taxas escondidas</span>
</div>
```
Usar quando um número é protagonista. Não usar com vários dados de peso igual (use tabela).

## strike-pill — antes/depois
```html
<div class="strike-pill">
  <span class="before">R$ 300k antecipados</span>
  <span class="after">R$ 147k recebidos</span>
</div>
```
Usar para contraste antes→depois / valor cheio→valor real.

## tag — categorização (label do slide)
```html
<span class="tag">ARMADILHA</span>
<span class="tag niche">AGÊNCIAS</span>
```
Topo do slide, uppercase. `.niche` para segmento (Nicho Attack).

## insight-box — citação / leitura da marca
```html
<div class="insight-box">
  <span class="icon">💡</span>
  <p>"Frase-tese curta que sintetiza a leitura."</p>
  <span class="source">— atribuição opcional</span>
</div>
```
Usar para a virada/insight ou uma fala anonimizada. Uma por slide.

## feature-list — checklist de benefícios/itens
```html
<div class="feature-list">
  <div class="feature-item">
    <span class="icon">✅</span>
    <div><strong>Título curto</strong><p>Explicação em uma linha.</p></div>
  </div>
</div>
```
2–4 itens. Usar em slides de saída/resultado.

## numbered-steps — passos numerados
```html
<div class="step">
  <span class="step-number">01</span>
  <div><strong>Nome do passo</strong><p>O que fazer.</p></div>
</div>
```
Usar no método (Raio-X, Caso na Prática). 1 passo por bloco.

## cta-button — chamada de ação (só no último slide)
```html
<div class="cta-button"><span>COMENTA "PALAVRA" →</span></div>
```
Fundo `--P` ou `--ALERT`, uppercase, 700. Diretivo, nunca cordial ("comenta X, recebe Y") — ver `filtro-anti-slop.md`.

## source-badge — fonte do dado
```html
<span class="source-badge">Fonte: [Órgão], [ano]</span>
```
Canto inferior, ~10px, opacity ~0.7. Obrigatório sempre que houver número/estatística no slide.

## Tabela — 3+ dados comparáveis
```html
<table class="data-table">
  <tr><th>Indicador</th><th>Valor</th></tr>
  <tr><td>...</td><td><strong>...</strong></td></tr>
</table>
```
Usar quando há 3+ linhas de dado comparável. Menos de 3 → `data-pill`.

## Imagem (`img-box`) — opcional
Default do slide é **sem imagem** (`imagem.tipo: none`). Quando o usuário fornece um arquivo (`local`), o render embute em base64. Imagem interna só em slide `dark`, com overlay ≥ 70% para legibilidade. Capa pode usar foto full-bleed + gradiente; sem foto, capa cai para fundo sólido/gradiente da marca + headline.
