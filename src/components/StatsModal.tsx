import React, { useState, useEffect } from 'react';
import { Lernhilfe, LernhilfeStats } from '../types';
import { fetchLernhilfeStats, resetLernhilfeStats } from '../utils/statsService';
import {
  X,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  Eye,
  RefreshCw,
  Sparkles,
  Layers,
  HelpCircle,
  TrendingUp,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface StatsModalProps {
  item: Lernhilfe;
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ item, onClose }) => {
  const [stats, setStats] = useState<LernhilfeStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [resetting, setResetting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    const data = await fetchLernhilfeStats(item.id);
    setStats(data);
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, [item.id]);

  const handleReset = async () => {
    const confirmed = window.confirm(
      `Möchtest du alle Aufruf- und Feedback-Statistiken für "${item.title}" wirklich auf 0 zurücksetzen? (z.B. für eine neue Klasse oder ein neues Schuljahr)`
    );
    if (!confirmed) return;

    setResetting(true);
    await resetLernhilfeStats(item.id);
    await loadStats();
    setResetting(false);
    setFeedbackMessage('Statistiken erfolgreich zurückgesetzt.');
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  // Aggregated totals across all hints
  const totalViews = stats?.totalViews || 0;
  let totalUp = 0;
  let totalDown = 0;

  if (stats?.hintStats) {
    Object.values(stats.hintStats).forEach((h) => {
      totalUp += h.helpfulCount || 0;
      totalDown += h.unhelpfulCount || 0;
    });
  }

  const totalVotes = totalUp + totalDown;
  const overallHelpfulPercent = totalVotes > 0 ? Math.round((totalUp / totalVotes) * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {item.subject || 'Allgemein'}
                </span>
                {item.grade_level && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700">
                    {item.grade_level}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg truncate">
                Statistik: {item.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={loadStats}
              disabled={loading}
              title="Aktualisieren"
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto">
          {feedbackMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedbackMessage}</span>
            </div>
          )}

          {/* Overview KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Card 1: Total Card Opens */}
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>QR-Aufrufe</span>
                <Eye className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                {totalViews}
              </p>
              <span className="text-[10px] text-slate-400">Schüler-Öffnungen</span>
            </div>

            {/* Card 2: Feedback Submissions */}
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Bewertungen</span>
                <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                {totalVotes}
              </p>
              <span className="text-[10px] text-slate-400">Schüler-Stimmen</span>
            </div>

            {/* Card 3: Thumbs Up */}
            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 p-3.5 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <span>Hilfreich</span>
                <ThumbsUp className="w-3.5 h-3.5" />
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                {totalUp}
              </p>
              <span className="text-[10px] text-emerald-600/80">Daumen hoch 👍</span>
            </div>

            {/* Card 4: Helpfulness Rate */}
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Erfolgsquote</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                {overallHelpfulPercent !== null ? `${overallHelpfulPercent}%` : '–'}
              </p>
              <span className="text-[10px] text-slate-400">
                {totalVotes > 0 ? 'Zufriedenheit' : 'Noch keine Stimmen'}
              </span>
            </div>
          </div>

          {/* Stepped Hints Detailed Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-500" />
                <span>Auswertung der einzelnen Tippkarten ({item.hints.length})</span>
              </h4>
              <span className="text-xs text-slate-400">
                Aufrufe &amp; Schüler-Resonanz
              </span>
            </div>

            <div className="space-y-3">
              {item.hints.map((hint, idx) => {
                const hintStat = stats?.hintStats?.[hint.id] || {
                  hintId: hint.id,
                  views: 0,
                  helpfulCount: 0,
                  unhelpfulCount: 0,
                };

                const hUp = hintStat.helpfulCount || 0;
                const hDown = hintStat.unhelpfulCount || 0;
                const hVotes = hUp + hDown;
                const hPercent = hVotes > 0 ? Math.round((hUp / hVotes) * 100) : null;
                const hViews = hintStat.views || (idx === 0 ? totalViews : 0);

                // Calculate drop-off / utilization rate relative to total task opens
                const utilizationRate =
                  totalViews > 0 ? Math.min(100, Math.round((hViews / totalViews) * 100)) : 0;

                const hasPin = !!hint.pin && hint.pin.trim().length > 0;

                return (
                  <div
                    key={hint.id || idx}
                    className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 shadow-2xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <h5 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            {hint.title || `Tipp ${idx + 1}`}
                          </h5>
                          {hasPin && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                              <Lock className="w-3 h-3" />
                              <span>PIN: {hint.pin}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Views & Votes quick numbers */}
                      <div className="flex items-center gap-3 text-xs self-start sm:self-auto">
                        <span className="flex items-center gap-1 text-slate-500 font-medium tabular-nums" title="Wie oft dieser Tipp aufgedeckt wurde">
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span>{hViews} Aufrufe ({utilizationRate}%)</span>
                        </span>

                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                            <ThumbsUp className="w-3 h-3" />
                            <span>{hUp}</span>
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold tabular-nums">
                            <ThumbsDown className="w-3 h-3" />
                            <span>{hDown}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar of Helpfulness */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Schüler-Zufriedenheit:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {hPercent !== null ? `${hPercent}% Hilfreich (${hVotes} ${hVotes === 1 ? 'Stimme' : 'Stimmen'})` : 'Noch keine Bewertung'}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                        {hVotes > 0 ? (
                          <>
                            <div
                              style={{ width: `${hPercent}%` }}
                              className="h-full bg-emerald-500 transition-all duration-500"
                              title={`${hUp} Schüler fanden diesen Tipp hilfreich (${hPercent}%)`}
                            />
                            <div
                              style={{ width: `${100 - (hPercent || 0)}%` }}
                              className="h-full bg-rose-400 transition-all duration-500"
                              title={`${hDown} Schüler fanden diesen Tipp nicht hilfreich`}
                            />
                          </>
                        ) : (
                          <div className="h-full w-full bg-slate-200 dark:bg-slate-800 opacity-50" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Didactic Scaffolding Diagnostic Box */}
          <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Didaktische Interpretation &amp; Differenzierung</span>
            </div>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-disc list-inside leading-relaxed">
              <li>
                <strong>Verständlichkeit:</strong> Ein hoher Daumen-hoch-Anteil zeigt, dass der Tipp den Denkprozess aktiviert, ohne die Lösung vorwegzunehmen.
              </li>
              <li>
                <strong>Tipp-Überarbeitung:</strong> Wenn ein Tipp viele Daumen nach unten erhält, ist die Formulierung möglicherweise missverständlich oder der Zwischenschritt zu groß.
              </li>
              <li>
                <strong>Spamschutz:</strong> Jeder Schüler kann pro Tipp maximal eine Stimme abgeben (anonyme IP- &amp; Geräteprüfung).
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            disabled={resetting}
            onClick={handleReset}
            className="px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg border border-rose-200 dark:border-rose-900/60 font-semibold flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Statistiken zurücksetzen</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
