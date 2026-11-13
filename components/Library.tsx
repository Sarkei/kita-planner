import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { SavedOffer, OfferCategory } from '../types';
import {
  Calendar,
  Trash2,
  Eye,
  FolderOpen,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useConfirm } from './Confirm';
import { useToasts } from '../src/components/Toasts';
import { api } from '../services/api';
import { getSeasonYearLabelFromTimestamp } from '../utils/seasonYear';
import { isMistralConfigured } from '../services/mistralService';
import { orderOffersByIdList, semanticLibraryRank } from '../services/libraryAiSearch';

interface LibraryProps {
  onSelect: (offer: SavedOffer) => void;
}

const PAGE_SIZE = 24;
const SEMANTIC_FETCH_LIMIT = 180;

function formatLoadError(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message.trim()) {
    const m = e.message.trim();
    return m.length > 500 ? `${m.slice(0, 497)}…` : m;
  }
  return fallback;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

const Library: React.FC<LibraryProps> = ({ onSelect }) => {
  const location = useLocation();

  const [meta, setMeta] = useState<{ total: number; periods: string[] } | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [serverOffers, setServerOffers] = useState<SavedOffer[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);

  const [semanticRows, setSemanticRows] = useState<SavedOffer[] | null>(null);

  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [semanticMode, setSemanticMode] = useState(false);

  const confirm = useConfirm();
  const toasts = useToasts();
  const mistralReady = isMistralConfigured();

  const semanticActive = semanticMode && mistralReady && debouncedSearch.trim().length >= 2;

  const loadMeta = useCallback(async () => {
    setMetaError(null);
    try {
      const m = await api.getOffersMeta();
      setMeta(m);
    } catch (e) {
      console.error(e);
      setMetaError(formatLoadError(e, 'Metadaten der Bibliothek konnten nicht geladen werden.'));
    }
  }, []);

  useEffect(() => {
    if (location.pathname !== '/bibliothek') return;
    void loadMeta();
  }, [location.pathname, loadMeta, reloadNonce]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategory, selectedPeriod, semanticMode]);

  /* KI: Kandidaten holen & sortieren (ohne serverseitigen q). */
  useEffect(() => {
    if (location.pathname !== '/bibliothek' || !semanticActive) {
      setSemanticRows(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setListLoading(true);
      setAiLoading(true);
      setError(null);
      try {
        const bulk = await api.getOffers({
          page: 1,
          limit: SEMANTIC_FETCH_LIMIT,
          category: selectedCategory,
          period: selectedPeriod,
        });
        const q = debouncedSearch.trim();
        const ids = await semanticLibraryRank(q, bulk.offers as SavedOffer[]);
        if (cancelled) return;
        setSemanticRows(orderOffersByIdList(bulk.offers as SavedOffer[], ids));
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError(
            formatLoadError(e, 'Fehler bei der KI-Suche. Bitte später erneut versuchen.'),
          );
        }
      } finally {
        if (!cancelled) {
          setListLoading(false);
          setAiLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    location.pathname,
    semanticActive,
    debouncedSearch,
    selectedCategory,
    selectedPeriod,
    reloadNonce,
  ]);

  /* Klassisch: Pagination & Volltext über API. */
  useEffect(() => {
    if (location.pathname !== '/bibliothek' || semanticActive) {
      return;
    }

    let cancelled = false;
    (async () => {
      setListLoading(true);
      setError(null);
      try {
        const data = await api.getOffers({
          page,
          limit: PAGE_SIZE,
          q: debouncedSearch.trim(),
          category: selectedCategory,
          period: selectedPeriod,
        });
        if (cancelled) return;
        setServerOffers(data.offers as SavedOffer[]);
        setServerTotal(data.total);
        setServerTotalPages(data.totalPages);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError(
            formatLoadError(e, 'Fehler beim Laden der Bibliothek. Bitte versuche es später erneut.'),
          );
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    location.pathname,
    semanticActive,
    page,
    debouncedSearch,
    selectedCategory,
    selectedPeriod,
    reloadNonce,
  ]);

  const visibleOffers = useMemo(() => {
    if (semanticActive && semanticRows) {
      const start = (page - 1) * PAGE_SIZE;
      return semanticRows.slice(start, start + PAGE_SIZE);
    }
    return serverOffers;
  }, [semanticActive, semanticRows, page, serverOffers]);

  const matchTotal = semanticActive && semanticRows ? semanticRows.length : serverTotal;
  const matchPages = semanticActive && semanticRows
    ? Math.max(1, Math.ceil(semanticRows.length / PAGE_SIZE))
    : serverTotalPages;

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: 'Eintrag löschen', description: 'Wirklich löschen?' });
    if (!ok) return;
    try {
      await api.deleteOffer(id);
      setSemanticRows((prev) => (prev ? prev.filter((o) => o.id !== id) : prev));
      setServerOffers((prev) => prev.filter((o) => o.id !== id));
      setServerTotal((t) => Math.max(0, t - 1));
      setReloadNonce((n) => n + 1);
    } catch (err) {
      console.error('Failed to delete offer:', err);
      toasts.push({ type: 'error', message: 'Fehler beim Löschen des Angebots.' });
      setReloadNonce((n) => n + 1);
    }
  };

  const totalInCollection = meta != null ? meta.total : serverTotal;
  const periodChips = meta?.periods ?? [];

  if (listLoading && visibleOffers.length === 0 && !error && !metaError) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="animate-spin text-accent" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
        <div className="bg-danger-soft p-4 rounded-full mb-4 text-danger">
          <Trash2 size={48} />
        </div>
        <h3 className="text-xl font-bold text-ink">Hoppla!</h3>
        <p className="text-muted mt-2 max-w-md">{error}</p>
        <button
          type="button"
          onClick={() => setReloadNonce((n) => n + 1)}
          className="mt-6 px-6 py-2 bg-accent text-on-accent rounded-full hover:bg-accent-hover transition-colors shadow-sm shadow-accent/15"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (totalInCollection === 0 && !listLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-surface rounded-2xl border border-dashed border-line text-center animate-fade-in">
        <div className="bg-surface-2 p-4 rounded-full mb-4">
          <FolderOpen size={48} className="text-placeholder" />
        </div>
        <h3 className="text-xl font-bold text-ink">Noch keine Angebote gespeichert</h3>
        <p className="text-muted mt-2 max-w-md">
          Erstelle dein erstes pädagogisches Angebot im Generator — es landet automatisch in der Bibliothek.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {metaError && (
        <p className="text-sm text-warn bg-warn-soft border border-warn/30 rounded-xl px-4 py-2">
          {metaError}
        </p>
      )}

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="app-section__title">Deine Sammlung</h2>
          <p className="app-section__note mt-1">
            {totalInCollection} {totalInCollection === 1 ? 'Angebot' : 'Angebote'} gespeichert
            {debouncedSearch.trim() || selectedCategory !== 'all' || selectedPeriod !== 'all' || semanticMode
              ? ` · Treffer: ${matchTotal}`
              : ''}
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full lg:max-w-3xl">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative min-w-[200px] sm:min-w-[220px]">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-surface border border-line focus:ring-2 focus:ring-accent outline-none text-sm shadow-sm appearance-none cursor-pointer text-ink"
              >
                <option value="all">Alle Kategorien</option>
                {Object.values(OfferCategory).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-3 top-3 text-muted pointer-events-none" size={16} />
            </div>

            <div className="relative flex-1">
              <input
                type="search"
                placeholder={
                  semanticMode
                    ? 'z. B. Frühling, Bienen, draußen spielen…'
                    : 'Stichwort in Titel, Zielen, Schritten, Vorbereitung…'
                }
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-line focus:ring-2 focus:ring-accent outline-none text-sm shadow-sm text-ink"
              />
              <Search className="absolute left-3 top-3 text-muted" size={16} />
              {aiLoading && (
                <Loader2 className="absolute right-3 top-3 animate-spin text-accent" size={16} />
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-line-strong text-accent focus:ring-accent"
              checked={semanticMode}
              disabled={!mistralReady}
              onChange={(e) => setSemanticMode(e.target.checked)}
            />
            <Sparkles size={16} className="text-accent shrink-0" />
            <span>
              KI-Suche (versteht Begriffe wie „Frühling“ oder „Thema Biene“){' '}
              {!mistralReady && <span className="text-muted">— Mistral-API-Key fehlt</span>}
            </span>
          </label>
        </div>
      </div>

      {periodChips.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            type="button"
            onClick={() => setSelectedPeriod('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedPeriod === 'all'
                ? 'bg-accent text-on-accent'
                : 'bg-surface text-muted hover:bg-surface-2 border border-line'
            }`}
          >
            Alle Jahreszeiten
          </button>
          {periodChips.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedPeriod === p
                  ? 'bg-accent text-on-accent shadow-sm shadow-accent/15'
                  : 'bg-surface text-muted hover:bg-surface-2 border border-line'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {visibleOffers.length === 0 && !listLoading && (
        <div className="text-center py-12 text-muted">
          <Filter className="mx-auto mb-2 opacity-50" size={32} />
          <p>Keine Angebote für diese Suche oder Filter.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleOffers.map((offer) => (
          <div
            key={offer.id}
            className="bg-surface rounded-2xl border border-line overflow-hidden transition-all duration-300 group flex flex-col hover:border-accent/40"
          >
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent-ink bg-accent-soft px-2 py-1 rounded border border-accent/25">
                  {offer.input?.category ?? '–'}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(offer.id);
                    }}
                    className="text-placeholder hover:text-danger transition-colors p-1.5 hover:bg-danger-soft rounded"
                    title="Löschen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className="font-serif text-xl text-ink mb-3 line-clamp-2 flex-1 leading-tight">
                {offer.title}
              </h3>

              <div className="text-sm text-muted space-y-2 mb-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <Calendar size={14} />
                  {new Date(offer.savedAt).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                  <span className="text-xs text-muted">
                    · {getSeasonYearLabelFromTimestamp(offer.savedAt)}
                  </span>
                </div>
                <div className="pl-6 text-muted text-xs flex justify-between gap-2">
                  <span className="truncate">{offer.input?.targetGroup ?? '–'}</span>
                  <span className="shrink-0">{offer.input?.duration ?? '–'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelect(offer)}
                className="w-full py-3 bg-surface-2 text-ink font-semibold rounded-xl border border-accent/55 group-hover:border-accent group-hover:bg-accent group-hover:text-on-accent transition-colors flex items-center justify-center gap-2"
              >
                <Eye size={18} /> Ansehen
              </button>
            </div>
          </div>
        ))}
      </div>

      {matchPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || listLoading}
            className="p-2 rounded-full bg-surface border border-line disabled:opacity-50 hover:bg-surface-2 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium text-muted">
            Seite {page} von {matchPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(matchPages, p + 1))}
            disabled={page === matchPages || listLoading}
            className="p-2 rounded-full bg-surface border border-line disabled:opacity-50 hover:bg-surface-2 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Library;
