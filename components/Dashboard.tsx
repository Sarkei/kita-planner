import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DetailSheet, StatButton, type DetailDef } from './DetailSheet';
import {
  ArrowRight,
  BookOpen,
  Gauge,
  Library as LibraryIcon,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { api, type OffersMeta } from '../services/api';
import { OfferCategory, TargetGroup, type SavedOffer } from '../types';
import { getSeasonYearLabelFromTimestamp } from '../utils/seasonYear';

interface DashboardProps {
  apiUsage: { count: number; tokens: number };
  apiLimit: number;
  onOpenOffer: (offer: SavedOffer) => void;
}

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Startseite: Übersicht mit echten Kennzahlen, Bereichen und letzten Einträgen. */
const Dashboard: React.FC<DashboardProps> = ({ apiUsage, apiLimit, onOpenOffer }) => {
  const [meta, setMeta] = useState<OffersMeta | null>(null);
  const [recent, setRecent] = useState<SavedOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [detail, setDetail] = useState<DetailDef | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [m, list] = await Promise.all([
          api.getOffersMeta(),
          api.getOffers({ page: 1, limit: 3 }),
        ]);
        if (cancelled) return;
        setMeta(m);
        setRecent(list.offers);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError(
            e instanceof Error && e.message.trim()
              ? e.message.trim().slice(0, 300)
              : 'Die Übersicht konnte nicht geladen werden.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const retry = useCallback(() => setReload((n) => n + 1), []);

  const offersTotal = meta ? String(meta.total) : '—';
  const periodsTotal = meta ? String(meta.periods.length) : '—';

  // Jede Kennzahl ist anklickbar und zeigt die passenden Eintraege
  const ladenAngebote = async () => {
    const res = await fetch('/api/offers?limit=60', { credentials: 'include' });
    const d = (await res.json()) as { offers?: SavedOffer[] };
    return d.offers ?? [];
  };

  const stats = [
    {
      value: offersTotal,
      label: 'Angebote gespeichert',
      detail: {
        titel: 'Angebote gespeichert',
        hinweis: 'Alle gespeicherten Angebote, neueste zuerst.',
        hoeherBesser: true,
        laden: async () =>
          (await ladenAngebote()).map((o) => ({
            label: new Date(o.savedAt).toLocaleDateString('de-DE') + ' · ' + o.title,
            wert: 1,
          })),
      },
    },
    {
      value: String(Object.values(OfferCategory).length),
      label: 'Angebotsarten',
      detail: {
        titel: 'Angebotsarten',
        hinweis: 'Wie oft jede Angebotsart vorkommt.',
        laden: async () => {
          const zaehler = new Map<string, number>();
          for (const o of await ladenAngebote()) {
            zaehler.set(o.input.category, (zaehler.get(o.input.category) ?? 0) + 1);
          }
          return [...zaehler.entries()].map(([k, v]) => ({ label: k, wert: v })).sort((a, b) => b.wert - a.wert);
        },
      },
    },
    {
      value: String(Object.values(TargetGroup).length),
      label: 'Zielgruppen',
      detail: {
        titel: 'Zielgruppen',
        hinweis: 'Wie sich deine Angebote auf die Zielgruppen verteilen.',
        laden: async () => {
          const zaehler = new Map<string, number>();
          for (const o of await ladenAngebote()) {
            zaehler.set(o.input.targetGroup, (zaehler.get(o.input.targetGroup) ?? 0) + 1);
          }
          return [...zaehler.entries()].map(([k, v]) => ({ label: k, wert: v })).sort((a, b) => b.wert - a.wert);
        },
      },
    },
    {
      value: periodsTotal,
      label: 'Jahreszeiten belegt',
      detail: {
        titel: 'Jahreszeiten belegt',
        hinweis: 'Welche Jahreszeiten schon Angebote haben.',
        laden: async () => {
          const res = await fetch('/api/offers/meta', { credentials: 'include' });
          const m = (await res.json()) as OffersMeta;
          return (m.periods ?? []).map((p) => ({ label: p, wert: 1 }));
        },
      },
    },
  ];

  return (
    <>
      <header className="app-container app-hero">
        <p className="app-badge">Übersicht</p>
        <h1 className="app-title">Angebote planen, Ideen wiederfinden.</h1>
        <p className="app-lede">
          Kita-Planer schreibt pädagogische Angebote, illustriert Kamishibai-Geschichten und sammelt
          alles in einer Bibliothek, die sich durchsuchen lässt.
        </p>

        <dl className="stat-row">
          {stats.map((s) => (
            <StatButton key={s.label} value={s.value} label={s.label} onClick={() => setDetail({ ...s.detail } as DetailDef)} />
          ))}
        </dl>
      </header>

      <section className="app-container app-section">
        <div className="app-section__head">
          <h2 className="app-section__title">Bereiche</h2>
          <p className="app-section__note">
            {loading ? 'Zahlen werden geladen …' : 'Alles, was du zum Planen brauchst.'}
          </p>
        </div>

        <div className="app-grid app-grid--three">
          <Link to="/neu" className="app-card app-card--link">
            <div className="app-card__head">
              <Sparkles size={18} />
              <ArrowRight size={16} className="app-card__arrow" />
            </div>
            <h3 className="app-card__title">Neues Angebot</h3>
            <p className="app-card__text">
              Thema, Kategorie und Zielgruppe wählen — die KI schreibt Konzept, Material, Ziele und
              Ablauf. Bei Kamishibai entstehen die Bilder mit.
            </p>
          </Link>

          <Link to="/bibliothek" className="app-card app-card--link">
            <div className="app-card__head">
              <LibraryIcon size={18} />
              <ArrowRight size={16} className="app-card__arrow" />
            </div>
            <h3 className="app-card__title">Bibliothek</h3>
            <p className="app-card__text">
              {meta
                ? `${meta.total} ${meta.total === 1 ? 'Angebot' : 'Angebote'} gespeichert — nach Jahreszeit, Kategorie und Stichwort durchsuchen.`
                : 'Gespeicherte Angebote durchsuchen, filtern und erneut öffnen.'}
            </p>
          </Link>

          <a
            href="https://console.mistral.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="app-card app-card--link"
          >
            <div className="app-card__head">
              <Gauge size={18} />
              <ArrowRight size={16} className="app-card__arrow" />
            </div>
            <h3 className="app-card__title">KI-Nutzung</h3>
            <p className="app-card__text">
              {apiUsage.count} von {apiLimit} Anfragen heute, {Math.round(apiUsage.tokens / 1000)}k
              Tokens. Der Zähler läuft lokal; Details stehen in der Mistral-Konsole.
            </p>
          </a>
        </div>
      </section>

      <section className="app-band app-section">
        <div className="app-container">
          <div className="app-section__head">
            <h2 className="app-section__title">Zuletzt gespeichert</h2>
            <p className="app-section__note">Die drei jüngsten Einträge deiner Bibliothek.</p>
          </div>

          {error ? (
            <div className="mt-8 rounded-2xl border border-line bg-surface px-5 py-4">
              <p className="text-sm text-danger">{error}</p>
              <button type="button" onClick={retry} className="app-btn mt-4">
                Erneut versuchen
              </button>
            </div>
          ) : loading ? (
            <div className="mt-8 flex items-center gap-2 text-sm text-muted">
              <Loader2 size={16} className="animate-spin" />
              Bibliothek wird gelesen …
            </div>
          ) : recent.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-line bg-surface px-5 py-6">
              <BookOpen size={20} className="text-muted" />
              <p className="mt-3 text-sm text-muted">
                Noch kein Angebot gespeichert. Das erste landet automatisch in der Bibliothek.
              </p>
              <Link to="/neu" className="app-btn app-btn--primary mt-4">
                Erstes Angebot erstellen
              </Link>
            </div>
          ) : (
            <ul className="app-recent">
              {recent.map((offer) => (
                <li key={offer.id}>
                  <button type="button" className="app-recent__row" onClick={() => onOpenOffer(offer)}>
                    <span className="app-recent__cat">{offer.input?.category ?? 'Angebot'}</span>
                    <span className="app-recent__title">{offer.title}</span>
                    <span className="app-recent__meta">
                      {formatDate(offer.savedAt)} · {getSeasonYearLabelFromTimestamp(offer.savedAt)}
                    </span>
                    <ArrowRight size={16} className="app-card__arrow" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {detail && <DetailSheet def={detail} onClose={() => setDetail(null)} />}
    </>
  );
};

export default Dashboard;
