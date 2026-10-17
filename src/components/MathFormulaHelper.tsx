import React, { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import { Check, X, Plus } from 'lucide-react';

interface MathFormulaHelperProps {
  onInsertFormula: (latexSnippet: string) => void;
  onClose?: () => void;
}

const MATH_SHORTCUTS = [
  { label: 'Bruch', latex: '\\frac{a}{b}', preview: '\\frac{a}{b}' },
  { label: 'Wurzel', latex: '\\sqrt{x}', preview: '\\sqrt{x}' },
  { label: 'n-te Wurzel', latex: '\\sqrt[n]{x}', preview: '\\sqrt[3]{8}' },
  { label: 'Potenz', latex: 'x^{2}', preview: 'x^2' },
  { label: 'Tiefgestellt', latex: 'x_{1}', preview: 'x_1' },
  { label: 'Multiplikation', latex: '\\cdot', preview: '\\cdot' },
  { label: 'Plus-Minus', latex: '\\pm', preview: '\\pm' },
  { label: 'Ungefähr', latex: '\\approx', preview: '\\approx' },
  { label: 'Pi', latex: '\\pi', preview: '\\pi' },
  { label: 'Grad', latex: '90^\\circ', preview: '90^\\circ' },
  { label: 'Alpha', latex: '\\alpha', preview: '\\alpha' },
  { label: 'Beta', latex: '\\beta', preview: '\\beta' },
  { label: 'Gamma', latex: '\\gamma', preview: '\\gamma' },
  { label: 'Delta', latex: '\\Delta', preview: '\\Delta' },
  { label: 'Summe', latex: '\\sum_{i=1}^{n}', preview: '\\sum' },
  { label: 'Integral', latex: '\\int_{a}^{b} f(x)\\,dx', preview: '\\int' },
  { label: 'Vektor', latex: '\\vec{v}', preview: '\\vec{v}' },
  { label: 'Reaktionspfeil', latex: '\\longrightarrow', preview: '\\longrightarrow' },
  { label: 'Pythagoras', latex: 'a^2 + b^2 = c^2', preview: 'a^2+b^2=c^2' },
  { label: 'pq-Formel', latex: 'x_{1,2} = -\\frac{p}{2} \\pm \\sqrt{\\left(\\frac{p}{2}\\right)^2 - q}', preview: 'x_{1,2}' },
];

export const MathFormulaHelper: React.FC<MathFormulaHelperProps> = ({ onInsertFormula, onClose }) => {
  const [currentLatex, setCurrentLatex] = useState<string>('\\frac{a}{b}');
  const [insertedSuccess, setInsertedSuccess] = useState<boolean>(false);
  const mathfieldRef = useRef<HTMLDivElement>(null);

  // Initialize or mount MathLive if available
  useEffect(() => {
    // Dynamic import of mathlive
    let mathFieldElement: any = null;
    import('mathlive')
      .then((m) => {
        if (mathfieldRef.current && !mathfieldRef.current.querySelector('math-field')) {
          mathFieldElement = document.createElement('math-field') as any;
          mathFieldElement.setValue(currentLatex);
          mathFieldElement.style.width = '100%';
          mathFieldElement.style.padding = '10px 14px';
          mathFieldElement.style.fontSize = '1.25rem';
          mathFieldElement.style.borderRadius = '0.5rem';
          mathFieldElement.style.border = '1px solid #cbd5e1';
          mathFieldElement.style.backgroundColor = 'white';
          mathFieldElement.style.color = '#0f172a';
          mathFieldElement.addEventListener('input', (ev: any) => {
            setCurrentLatex(ev.target.value);
          });
          mathfieldRef.current.appendChild(mathFieldElement);
        }
      })
      .catch((err) => {
        console.warn('MathLive loaded in fallback mode:', err);
      });

    return () => {
      if (mathFieldElement && mathFieldElement.parentNode) {
        mathFieldElement.parentNode.removeChild(mathFieldElement);
      }
    };
  }, []);

  const handleAppendSymbol = (symbolLatex: string) => {
    const next = currentLatex ? `${currentLatex} ${symbolLatex}` : symbolLatex;
    setCurrentLatex(next);

    // Update mathfield if mounted
    const mf = mathfieldRef.current?.querySelector('math-field') as any;
    if (mf) {
      mf.executeCommand(['insert', symbolLatex]);
    }
  };

  const handleInsert = () => {
    if (!currentLatex.trim()) return;
    const formatted = `$${currentLatex.trim()}$`;
    onInsertFormula(formatted);
    // Explicitly do NOT close the editor so the user can insert multiple formulas without the page jumping!
    setInsertedSuccess(true);
    setTimeout(() => {
      setInsertedSuccess(false);
    }, 2000);
  };

  // Preview KaTeX string
  let renderedPreviewHtml = '';
  try {
    renderedPreviewHtml = katex.renderToString(currentLatex || '...', {
      displayMode: true,
      throwOnError: false,
    });
  } catch (e) {
    renderedPreviewHtml = `<span class="text-red-500 font-mono text-sm">${currentLatex}</span>`;
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-md space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Visueller Formel-Editor &amp; LaTeX-Assistent</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Formel bearbeiten und mit „Formel in Text einfügen“ übernehmen. Der Editor bleibt zum Weiterarbeiten geöffnet.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-semibold"
            title="Formel-Editor schließen"
          >
            <X className="w-4 h-4" />
            <span>Schließen</span>
          </button>
        )}
      </div>

      {/* MathLive visual field mount point */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
          Visuelles Formelfeld (interaktiv bearbeitbar):
        </label>
        <div ref={mathfieldRef} className="rounded-lg overflow-hidden" />
      </div>

      {/* Direct LaTeX Input fallback / inspection */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>LaTeX-Code:</span>
          <button
            type="button"
            onClick={() => setCurrentLatex('')}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Leeren
          </button>
        </div>
        <input
          type="text"
          value={currentLatex}
          onChange={(e) => setCurrentLatex(e.target.value)}
          placeholder="z.B. \\frac{a}{b} oder \\sqrt{x^2 + y^2}"
          className="w-full px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Schnell-Buttons */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          Schnell-Einfügen (MINT-Symbole):
        </span>
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
          {MATH_SHORTCUTS.map((sc, idx) => {
            let miniHtml = '';
            try {
              miniHtml = katex.renderToString(sc.preview, { throwOnError: false, displayMode: false });
            } catch (e) {
              miniHtml = sc.label;
            }
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleAppendSymbol(sc.latex)}
                title={`${sc.label}: ${sc.latex}`}
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-800 dark:hover:bg-indigo-900/40 text-slate-700 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <span dangerouslySetInnerHTML={{ __html: miniHtml }} />
                <span className="text-[10px] text-slate-400">({sc.label})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KaTeX Live Preview */}
      <div className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">
          Echtzeit-Vorschau:
        </span>
        <div
          className="text-center py-2 text-slate-900 dark:text-slate-100 min-h-[3rem] flex items-center justify-center overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: renderedPreviewHtml }}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 text-center sm:text-left">
          💡 Tipp: Du kannst mehrere Formeln nacheinander einfügen.
        </span>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-2xs"
            >
              Fertig / Schließen
            </button>
          )}
          <button
            type="button"
            onClick={handleInsert}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 ${
              insertedSuccess
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-98'
            }`}
          >
            {insertedSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Formel eingefügt! ✓</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Formel in Text einfügen</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
