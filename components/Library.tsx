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
        <Loader2 className="animate-spin text-orange-500" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full mb-4 text-red-500">
          <Trash2 size={48} />
        </div>
        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Hoppla!</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md">{error}</p>
        <button
          type="button"
          onClick={() => setReloadNonce((n) => n + 1)}
          className="mt-6 px-6 py-2 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors shadow-md shadow-orange-500/20"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (totalInCollection === 0 && !listLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-kita-cardDark rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center animate-fade-in">
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-full mb-4">
          <FolderOpen size={48} className="text-slate-300 dark:text-slate-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Noch keine Angebote gespeichert</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md">
          Erstelle dein erstes pädagogisches Angebot im Generator — es landet automatisch in der Bibliothek.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {metaError && (
        <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2">
          {metaError}
        </p>
      )}

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Bibliothek</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Deine Sammlung ({totalInCollection} {totalInCollection === 1 ? 'Angebot' : 'Angebote'})
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
                className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white dark:bg-kita-cardDark border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-orange-500 outline-none text-sm shadow-sm appearance-none cursor-pointer text-slate-700 dark:text-slate-200"
              >
                <option value="all">Alle Kategorien</option>
                {Object.values(OfferCategory).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={16} />
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-kita-cardDark border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-orange-500 outline-none text-sm shadow-sm text-slate-700 dark:text-slate-200"
              />
              <Search className="absolute left-3 top-3 text-slate-400" size={16} />
              {aiLoading && (
                <Loader2 className="absolute right-3 top-3 animate-spin text-orange-500" size={16} />
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              checked={semanticMode}
              disabled={!mistralReady}
              onChange={(e) => setSemanticMode(e.target.checked)}
            />
            <Sparkles size={16} className="text-violet-500 shrink-0" />
            <span>
              KI-Suche (versteht Begriffe wie „Frühling“ oder „Thema Biene“){' '}
              {!mistralReady && <span className="text-slate-400">— Mistral-API-Key fehlt</span>}
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
                ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
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
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {visibleOffers.length === 0 && !listLoading && (
        <div className="text-center py-12 text-slate-500">
          <Filter className="mx-auto mb-2 opacity-50" size={32} />
          <p>Keine Angebote für diese Suche oder Filter.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleOffers.map((offer) => (
          <div
            key={offer.id}
            className="bg-white dark:bg-kita-cardDark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-300 group flex flex-col hover:border-orange-300 dark:hover:border-orange-500/30"
          >
            <div className="h-2 bg-gradient-to-r from-orange-400 to-orange-600" />
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2 py-1 rounded border border-orange-100 dark:border-orange-500/20">
                  {offer.input?.category ?? '–'}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(offer.id);
                    }}
                    className="text-slate-300 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title="Löschen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-3 line-clamp-2 flex-1 leading-tight">
                {offer.title}
              </h3>

              <div className="text-sm text-slate-500 dark:text-slate-400 space-y-2 mb-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <Calendar size={14} />
                  {new Date(offer.savedAt).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    · {getSeasonYearLabelFromTimestamp(offer.savedAt)}
                  </span>
                </div>
                <div className="pl-6 text-slate-400 dark:text-slate-500 text-xs flex justify-between gap-2">
                  <span className="truncate">{offer.input?.targetGroup ?? '–'}</span>
                  <span className="shrink-0">{offer.input?.duration ?? '–'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelect(offer)}
                className="w-full py-3 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-xl group-hover:bg-orange-500 group-hover:text-white dark:group-hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
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
            className="p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Seite {page} von {matchPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(matchPages, p + 1))}
            disabled={page === matchPages || listLoading}
            className="p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Library;
