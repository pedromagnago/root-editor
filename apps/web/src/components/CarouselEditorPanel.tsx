// Painel de edição do carrossel (contrato slides.json V02/V03). Dock lateral
// do preview do deck: lista de slides + campos do slide selecionado + salvar
// explícito com dirty-signature (padrão McpClientSection). O PUT re-renderiza
// o deck.html no daemon e o preview atualiza sozinho via chokidar→SSE, então
// o painel nunca força reload do iframe.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Textarea } from '@open-design/components';
import { CustomSelect } from './CustomSelect';
import { Icon } from './Icon';
import { useI18n } from '../i18n';
import {
  CarouselSaveError,
  getCarouselDocument,
  listCarouselBrands,
  putCarouselDocument,
  type CarouselBrandSummary,
  type CarouselDocument,
  type CarouselSlideDoc,
} from '../state/projects';

const MIN_SLIDES = 4;
const MAX_SLIDES = 10;
const SLIDE_BG_TOKENS = ['light', 'dark', 'gradient', 'alert'] as const;

type SlideTipo = 'capa' | 'conteudo' | 'fechamento';

interface Props {
  projectId: string;
  // Bump do file-watcher do FileViewer: quando muda e o painel não está
  // dirty, refaz o GET em silêncio (o arquivo mudou por fora, ex. o agente
  // reescreveu o slides.json). Se estiver dirty, a edição local vence.
  filesRefreshKey?: number;
  onGoToSlide?: (index: number) => void;
  onClose: () => void;
}

function slideTipo(slide: CarouselSlideDoc, index: number, total: number): SlideTipo {
  if (slide.tipo === 'capa' || slide.tipo === 'conteudo' || slide.tipo === 'fechamento') {
    return slide.tipo;
  }
  if (index === 0) return 'capa';
  if (index === total - 1) return 'fechamento';
  return 'conteudo';
}

// Excerto da lista: o contrato permite <strong>/<em> literais no texto;
// a lista mostra só o texto puro.
function stripInlineMarkup(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function renumber(slides: CarouselSlideDoc[]): CarouselSlideDoc[] {
  return slides.map((slide, index) =>
    slide.ordem === index + 1 ? slide : { ...slide, ordem: index + 1 },
  );
}

// Normaliza o slide antes do PUT: blocos vazios saem do array (contrato:
// "vazio = bloco removido"), strings vazias de campos opcionais somem e um
// cta sem conteúdo é removido. `componentes`/`imagem`/chaves desconhecidas
// passam intactos — o painel não os edita.
function cleanSlide(slide: CarouselSlideDoc): CarouselSlideDoc {
  const next: CarouselSlideDoc = { ...slide };
  if (Array.isArray(next.blocos)) {
    const blocos = next.blocos.filter((bloco) => typeof bloco === 'string' && bloco.trim() !== '');
    if (blocos.length > 0) next.blocos = blocos;
    else delete next.blocos;
  }
  for (const key of ['tag', 'headline', 'source'] as const) {
    const value = next[key];
    if (typeof value === 'string' && value.trim() === '') delete next[key];
  }
  if (next.cta) {
    const cta = { ...next.cta };
    for (const key of ['instrucao', 'palavra', 'beneficio'] as const) {
      const value = cta[key];
      if (typeof value !== 'string' || value.trim() === '') delete cta[key];
    }
    if (Object.keys(cta).length > 0) next.cta = cta;
    else delete next.cta;
  } else if (next.cta === null) {
    delete next.cta;
  }
  return next;
}

function cleanDocument(document: CarouselDocument): CarouselDocument {
  return { ...document, slides: document.slides.map(cleanSlide) };
}

function signature(document: CarouselDocument): string {
  return JSON.stringify(document);
}

export function CarouselEditorPanel({ projectId, filesRefreshKey = 0, onGoToSlide, onClose }: Props) {
  const { t } = useI18n();
  const [doc, setDoc] = useState<CarouselDocument | null>(null);
  const [savedSig, setSavedSig] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ message: string; problems: string[] } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Marcas disponíveis para a troca explícita. Falha de rede degrada para
  // "sem seletor" — o deck continua editável, só não dá para trocar a marca.
  const [brands, setBrands] = useState<CarouselBrandSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listCarouselBrands()
      .then((list) => {
        if (!cancelled) setBrands(list);
      })
      .catch(() => {
        if (!cancelled) setBrands([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Dirty semântico: compara o documento NORMALIZADO — digitar e apagar um
  // campo opcional volta a "sem mudanças" em vez de habilitar um save no-op.
  const dirty = useMemo(
    () => doc !== null && signature(cleanDocument(doc)) !== savedSig,
    [doc, savedSig],
  );
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const { document } = await getCarouselDocument(projectId);
      setDoc(document);
      setSavedSig(signature(cleanDocument(document)));
      setSelectedIndex((current) =>
        Math.max(0, Math.min(current, (document.slides?.length ?? 1) - 1)),
      );
      setLoadError(null);
    } catch (err) {
      if (!silent) setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Sync externo: o arquivo mudou no disco (outro processo reescreveu o
  // slides.json). Só sobrescreve quando não há edição local pendente.
  const lastRefreshKeyRef = useRef(filesRefreshKey);
  useEffect(() => {
    if (filesRefreshKey === lastRefreshKeyRef.current) return;
    lastRefreshKeyRef.current = filesRefreshKey;
    if (dirtyRef.current) return;
    void load({ silent: true });
  }, [filesRefreshKey, load]);

  const totalSlides = doc?.slides.length ?? 0;

  const selectSlide = (index: number) => {
    setSelectedIndex(index);
    onGoToSlide?.(index);
  };

  const updateSlide = (index: number, patch: Partial<CarouselSlideDoc>) => {
    setDoc((current) => {
      if (!current) return current;
      const slides = current.slides.map((slide, i) =>
        i === index ? { ...slide, ...patch } : slide,
      );
      return { ...current, slides };
    });
  };

  // blocos edita como dois "slots" fixos (a filtragem de vazios acontece só
  // no save), para o textarea 1 não herdar o texto do 2 no meio da digitação.
  const updateBloco = (index: number, slot: 0 | 1, value: string) => {
    setDoc((current) => {
      if (!current) return current;
      const slides = current.slides.map((slide, i) => {
        if (i !== index) return slide;
        const blocos: string[] = [slide.blocos?.[0] ?? '', slide.blocos?.[1] ?? ''];
        blocos[slot] = value;
        const next = { ...slide };
        if (blocos[0] === '' && blocos[1] === '') delete next.blocos;
        else next.blocos = blocos;
        return next;
      });
      return { ...current, slides };
    });
  };

  const updateCta = (index: number, key: 'instrucao' | 'palavra' | 'beneficio', value: string) => {
    setDoc((current) => {
      if (!current) return current;
      const slides = current.slides.map((slide, i) => {
        if (i !== index) return slide;
        const cta = { ...(slide.cta ?? {}), [key]: value };
        const empty = ['instrucao', 'palavra', 'beneficio'].every((field) => {
          const fieldValue = (cta as Record<string, unknown>)[field];
          return typeof fieldValue !== 'string' || fieldValue === '';
        });
        const next = { ...slide };
        if (empty) delete next.cta;
        else next.cta = cta;
        return next;
      });
      return { ...current, slides };
    });
  };

  const moveSlide = (index: number, dir: -1 | 1) => {
    if (!doc) return;
    const total = doc.slides.length;
    const target = index + dir;
    // Só slides do meio se movem, e só dentro da faixa do meio: capa fixa
    // na posição 1, fechamento fixo no fim (regra estrutural do contrato).
    if (index <= 0 || index >= total - 1) return;
    if (target <= 0 || target >= total - 1) return;
    const slides = [...doc.slides];
    const a = slides[index];
    const b = slides[target];
    if (!a || !b) return;
    slides[index] = b;
    slides[target] = a;
    setDoc({ ...doc, slides: renumber(slides) });
    setSelectedIndex((current) => {
      if (current === index) return target;
      if (current === target) return index;
      return current;
    });
  };

  const addSlide = () => {
    if (!doc || doc.slides.length >= MAX_SLIDES) return;
    const total = doc.slides.length;
    // Logo após o selecionado, nunca antes da capa nem depois do fechamento.
    const insertAt = Math.min(Math.max(selectedIndex + 1, 1), total - 1);
    const slide: CarouselSlideDoc = {
      ordem: insertAt + 1,
      bg: 'dark',
      papel: 'conteudo',
      tipo: 'conteudo',
      headline: '',
      blocos: [],
    };
    const slides = [...doc.slides];
    slides.splice(insertAt, 0, slide);
    setDoc({ ...doc, slides: renumber(slides) });
    setSelectedIndex(insertAt);
  };

  const removeSlide = (index: number) => {
    if (!doc) return;
    const total = doc.slides.length;
    if (total <= MIN_SLIDES || index <= 0 || index >= total - 1) return;
    const slides = renumber(doc.slides.filter((_, i) => i !== index));
    setDoc({ ...doc, slides });
    setSelectedIndex((current) => {
      if (current > index) return current - 1;
      return Math.min(current, slides.length - 1);
    });
  };

  const save = async () => {
    if (!doc || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const cleaned = cleanDocument(doc);
      await putCarouselDocument(projectId, cleaned);
      // Re-hidrata a assinatura com o documento normalizado que foi
      // persistido; o preview atualiza sozinho via watcher do daemon.
      setDoc(cleaned);
      setSavedSig(signature(cleaned));
    } catch (err) {
      if (err instanceof CarouselSaveError) {
        setSaveError({ message: err.message, problems: err.problems });
      } else {
        setSaveError({
          message: err instanceof Error ? err.message : String(err),
          problems: [],
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const tipoLabel = (tipo: SlideTipo): string => {
    if (tipo === 'capa') return t('carouselEditor.typeCapa');
    if (tipo === 'fechamento') return t('carouselEditor.typeFechamento');
    return t('carouselEditor.typeConteudo');
  };

  const bgOptions = SLIDE_BG_TOKENS.map((token) => ({
    value: token,
    label:
      token === 'light'
        ? t('carouselEditor.bgLight')
        : token === 'dark'
          ? t('carouselEditor.bgDark')
          : token === 'gradient'
            ? t('carouselEditor.bgGradient')
            : t('carouselEditor.bgAlert'),
  }));

  const selectedSlide = doc?.slides[selectedIndex] ?? null;
  const selectedTipo = selectedSlide && doc
    ? slideTipo(selectedSlide, selectedIndex, doc.slides.length)
    : null;

  let body;
  if (loading) {
    body = <div className="carousel-editor-status">{t('carouselEditor.loading')}</div>;
  } else if (loadError !== null || !doc) {
    body = (
      <div className="carousel-editor-status" role="alert">
        <p>{loadError ?? t('carouselEditor.loadFailed')}</p>
        <Button onClick={() => void load()}>{t('carouselEditor.retry')}</Button>
      </div>
    );
  } else {
    const deckBrand = doc.brand_pack_ref ?? '';
    body = (
      <>
        {brands.length > 0 ? (
          <div className="carousel-editor-fields carousel-editor-brand">
            <label className="carousel-editor-field">
              <span>{t('carouselEditor.brand')}</span>
              <CustomSelect
                value={deckBrand}
                onChange={(slug) => {
                  // Troca local do documento: entra no dirty-signature como
                  // qualquer outro campo e é aplicada no Save, que re-renderiza
                  // o deck. Nunca troca a marca ATIVA global — editar este deck
                  // não pode mudar com o que os outros são renderizados.
                  setDoc((curr) => (curr ? { ...curr, brand_pack_ref: slug } : curr));
                }}
                options={[
                  { value: '', label: t('carouselEditor.brandInherit') },
                  ...brands.map((b) => ({ value: b.slug, label: b.nome || b.slug })),
                ]}
                ariaLabel={t('carouselEditor.brand')}
              />
            </label>
          </div>
        ) : null}
        <div className="carousel-editor-body">
          <div className="carousel-editor-list" role="list" aria-label={t('carouselEditor.slides')}>
            {doc.slides.map((slide, index) => {
              const tipo = slideTipo(slide, index, doc.slides.length);
              const movable = index > 0 && index < doc.slides.length - 1;
              const lockedTitle =
                tipo === 'capa'
                  ? t('carouselEditor.coverLocked')
                  : tipo === 'fechamento'
                    ? t('carouselEditor.closingLocked')
                    : undefined;
              const excerpt = stripInlineMarkup(slide.headline ?? '');
              const selected = index === selectedIndex;
              return (
                <div
                  key={index}
                  role="listitem"
                  className={`carousel-editor-slide${selected ? ' selected' : ''}`}
                  title={movable ? undefined : lockedTitle}
                >
                  <button
                    type="button"
                    className="carousel-editor-slide-main"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => selectSlide(index)}
                  >
                    <span className="carousel-editor-slide-label">
                      {slide.ordem} · {tipoLabel(tipo)}
                    </span>
                    <span className="carousel-editor-slide-excerpt">
                      {excerpt || t('carouselEditor.noHeadline')}
                    </span>
                  </button>
                  {movable ? (
                    <span className="carousel-editor-slide-actions">
                      <button
                        type="button"
                        className="carousel-editor-icon-button"
                        aria-label={t('carouselEditor.moveUp')}
                        title={index <= 1 ? t('carouselEditor.coverLocked') : t('carouselEditor.moveUp')}
                        disabled={index <= 1}
                        onClick={() => moveSlide(index, -1)}
                      >
                        <Icon name="chevron-down" size={13} style={{ transform: 'rotate(180deg)' }} />
                      </button>
                      <button
                        type="button"
                        className="carousel-editor-icon-button"
                        aria-label={t('carouselEditor.moveDown')}
                        title={
                          index >= doc.slides.length - 2
                            ? t('carouselEditor.closingLocked')
                            : t('carouselEditor.moveDown')
                        }
                        disabled={index >= doc.slides.length - 2}
                        onClick={() => moveSlide(index, 1)}
                      >
                        <Icon name="chevron-down" size={13} />
                      </button>
                      <button
                        type="button"
                        className="carousel-editor-icon-button carousel-editor-remove"
                        aria-label={t('carouselEditor.removeSlide')}
                        title={
                          doc.slides.length <= MIN_SLIDES
                            ? t('carouselEditor.removeSlideMin')
                            : t('carouselEditor.removeSlide')
                        }
                        disabled={doc.slides.length <= MIN_SLIDES}
                        onClick={() => removeSlide(index)}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="carousel-editor-add-row">
            <Button
              disabled={totalSlides >= MAX_SLIDES}
              title={totalSlides >= MAX_SLIDES ? t('carouselEditor.addSlideMax') : undefined}
              onClick={addSlide}
            >
              <Icon name="plus" size={13} />
              {t('carouselEditor.addSlide')}
            </Button>
          </div>
          {selectedSlide && selectedTipo ? (
            <div className="carousel-editor-fields">
              {selectedTipo === 'conteudo' ? (
                <label className="carousel-editor-field">
                  <span>{t('carouselEditor.fieldTag')}</span>
                  <Input
                    value={selectedSlide.tag ?? ''}
                    onChange={(event) => updateSlide(selectedIndex, { tag: event.target.value })}
                  />
                </label>
              ) : null}
              <label className="carousel-editor-field">
                <span>{t('carouselEditor.fieldHeadline')}</span>
                <Textarea
                  rows={3}
                  value={selectedSlide.headline ?? ''}
                  onChange={(event) => updateSlide(selectedIndex, { headline: event.target.value })}
                />
              </label>
              {selectedTipo !== 'capa' ? (
                <>
                  <label className="carousel-editor-field">
                    <span>{t('carouselEditor.fieldBlock1')}</span>
                    <Textarea
                      rows={3}
                      value={selectedSlide.blocos?.[0] ?? ''}
                      onChange={(event) => updateBloco(selectedIndex, 0, event.target.value)}
                    />
                  </label>
                  <label className="carousel-editor-field">
                    <span>{t('carouselEditor.fieldBlock2')}</span>
                    <Textarea
                      rows={3}
                      value={selectedSlide.blocos?.[1] ?? ''}
                      onChange={(event) => updateBloco(selectedIndex, 1, event.target.value)}
                    />
                  </label>
                </>
              ) : null}
              {selectedTipo === 'conteudo' ? (
                <label className="carousel-editor-field">
                  <span>{t('carouselEditor.fieldSource')}</span>
                  <Input
                    value={selectedSlide.source ?? ''}
                    onChange={(event) => updateSlide(selectedIndex, { source: event.target.value })}
                  />
                </label>
              ) : null}
              {selectedTipo === 'fechamento' ? (
                <>
                  <label className="carousel-editor-field">
                    <span>{t('carouselEditor.fieldCtaInstrucao')}</span>
                    <Input
                      value={selectedSlide.cta?.instrucao ?? ''}
                      onChange={(event) => updateCta(selectedIndex, 'instrucao', event.target.value)}
                    />
                  </label>
                  <label className="carousel-editor-field">
                    <span>{t('carouselEditor.fieldCtaPalavra')}</span>
                    <Input
                      value={selectedSlide.cta?.palavra ?? ''}
                      onChange={(event) => updateCta(selectedIndex, 'palavra', event.target.value)}
                    />
                  </label>
                  <label className="carousel-editor-field">
                    <span>{t('carouselEditor.fieldCtaBeneficio')}</span>
                    <Input
                      value={selectedSlide.cta?.beneficio ?? ''}
                      onChange={(event) => updateCta(selectedIndex, 'beneficio', event.target.value)}
                    />
                  </label>
                </>
              ) : null}
              <div className="carousel-editor-field">
                <span id="carousel-editor-bg-label">{t('carouselEditor.fieldBg')}</span>
                <CustomSelect
                  value={
                    SLIDE_BG_TOKENS.includes(selectedSlide.bg as (typeof SLIDE_BG_TOKENS)[number])
                      ? selectedSlide.bg
                      : 'dark'
                  }
                  options={bgOptions}
                  onChange={(value) => updateSlide(selectedIndex, { bg: value })}
                  ariaLabel={t('carouselEditor.fieldBg')}
                  labelledBy="carousel-editor-bg-label"
                />
              </div>
              {Array.isArray(selectedSlide.componentes) && selectedSlide.componentes.length > 0 ? (
                <div
                  className="carousel-editor-components"
                  title={t('carouselEditor.componentsHint')}
                >
                  <Icon name="blocks" size={13} />
                  <span>
                    {t('carouselEditor.componentsBadge', {
                      count: selectedSlide.componentes.length,
                    })}
                  </span>
                </div>
              ) : null}
              {selectedSlide.imagem?.tipo === 'local' && selectedSlide.imagem.ref ? (
                <div className="carousel-editor-image-ref">
                  <span>{t('carouselEditor.imageRef')}</span>
                  <code>{selectedSlide.imagem.ref}</code>
                </div>
              ) : null}
              <p className="carousel-editor-markup-hint">{t('carouselEditor.markupHint')}</p>
            </div>
          ) : null}
        </div>
        {saveError ? (
          <div className="carousel-editor-error" role="alert">
            <span>
              {saveError.problems.length > 0
                ? t('carouselEditor.problemsTitle')
                : t('carouselEditor.saveFailed')}
            </span>
            {saveError.problems.length > 0 ? (
              <ul>
                {saveError.problems.map((problem, index) => (
                  <li key={index}>{problem}</li>
                ))}
              </ul>
            ) : (
              <p>{saveError.message}</p>
            )}
          </div>
        ) : null}
        <div className="carousel-editor-footer">
          {dirty ? (
            <span className="carousel-editor-unsaved">{t('carouselEditor.unsaved')}</span>
          ) : null}
          <Button variant="primary" disabled={saving || !dirty} onClick={() => void save()}>
            {saving ? t('carouselEditor.saving') : t('carouselEditor.save')}
          </Button>
        </div>
      </>
    );
  }

  return (
    <aside
      className="carousel-editor-panel"
      data-testid="carousel-editor-panel"
      aria-label={t('carouselEditor.title')}
    >
      <div className="carousel-editor-header">
        <div className="carousel-editor-title">
          <Icon name="layout" size={14} />
          <span>{t('carouselEditor.title')}</span>
        </div>
        <button
          type="button"
          className="carousel-editor-icon-button"
          aria-label={t('carouselEditor.close')}
          title={t('carouselEditor.close')}
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      {body}
    </aside>
  );
}
