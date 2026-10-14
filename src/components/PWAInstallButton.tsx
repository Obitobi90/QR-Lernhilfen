import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Smartphone, Share, PlusSquare, X, Check, MoreVertical, Apple } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [activePlatform, setActivePlatform] = useState<'ios' | 'android'>(isIOS ? 'ios' : 'android');

  // If already running as an installed PWA on the home screen, hide the install button
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const installed = await install();
      if (!installed) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Als native App auf dem Smartphone installieren"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors shadow-2xs whitespace-nowrap"
      >
        <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
        <span>App installieren</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/apple-touch-icon.png"
                  alt="App Icon"
                  className="w-12 h-12 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800"
                />
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Lernhilfen App
                  </h3>
                  <p className="text-xs text-slate-500">Auf dem Smartphone installieren</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Platform Selector Tabs */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActivePlatform('ios')}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activePlatform === 'ios'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <span>Apple iOS</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePlatform('android')}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activePlatform === 'android'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <span>Android</span>
              </button>
            </div>

            {/* iOS Instructions */}
            {activePlatform === 'ios' ? (
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 pt-1">
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  Im Safari-Browser auf deinem iPhone / iPad:
                </p>
                <div className="flex items-start gap-2.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Share className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>1.</strong> Unten in Safari auf das <strong>Teilen-Symbol</strong> tippen.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <PlusSquare className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>2.</strong> Nach unten scrollen und <strong>„Zum Home-Bildschirm“</strong> auswählen.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>3.</strong> Oben rechts auf <strong>„Hinzufügen“</strong> tippen – fertig!
                  </span>
                </div>
              </div>
            ) : (
              /* Android Instructions */
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 pt-1">
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  In Chrome oder Samsung Internet:
                </p>
                <div className="flex items-start gap-2.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <MoreVertical className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>1.</strong> Oben rechts auf das <strong>Dreipunkt-Menü (⋮)</strong> tippen.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Smartphone className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>2.</strong> Auf <strong>„App installieren“</strong> oder <strong>„Zum Startbildschirm hinzufügen“</strong> tippen.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>3.</strong> Mit <strong>„Installieren“</strong> bestätigen – die App verhält sich wie eine normale Smartphone-App.
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </>
  );
};
