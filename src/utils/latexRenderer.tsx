import React, { useMemo, useState } from 'react';
import katex from 'katex';
import { Sparkles, X, CheckCircle2 } from 'lucide-react';

interface LaTeXRendererProps {
  content: string;
  className?: string;
  glossary?: Record<string, string>;
  onTermClick?: (term: string, definition: string) => void;
}

/**
 * Parses markdown/plain text and renders embedded LaTeX expressions.
 * Handles both block math ($$...$$), inline math ($...$), and interactive [[Fachbegriffe]] (wiki-links).
 * Includes an automatic built-in modal fallback so terms are always clickable everywhere.
 */
export const LaTeXRenderer: React.FC<LaTeXRendererProps> = ({
  content,
  className = '',
  glossary,
  onTermClick,
}) => {
  const [internalGlossaryModal, setInternalGlossaryModal] = useState<{
    term: string;
    definition: string;
  } | null>(null);

  // Helper for case-insensitive and trimmed glossary lookup
  const getDefinition = (termName: string): string => {
    if (!glossary) return '';
    if (glossary[termName]) return glossary[termName];
    const trimmedLower = termName.trim().toLowerCase();
    for (const [k, v] of Object.entries(glossary)) {
      if (k.trim().toLowerCase() === trimmedLower) return v;
    }
    for (const [k, v] of Object.entries(glossary)) {
      const kLower = k.trim().toLowerCase();
      if (trimmedLower.startsWith(kLower) || kLower.startsWith(trimmedLower)) return v;
    }
    return '';
  };

  const renderedElements = useMemo(() => {
    if (!content) return null;

    // Tokenize text into parts: block math ($$...$$), inline math ($...$), and standard text
    const regex = /(\$\$[\s\S]+?\$\$|\$(?:\\\$|[^\$])+?\$)/g;
    const parts = content.split(regex);

    return parts.map((part, index) => {
      if (!part) return null;

      // Block math: starts and ends with $$
      if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
        const math = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(math, {
            displayMode: true,
            throwOnError: false,
          });
          return (
            <div
              key={`block-${index}`}
              className="my-3 overflow-x-auto text-center whitespace-nowrap max-w-full py-0.5"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch (e) {
          return (
            <pre key={`err-block-${index}`} className="my-2 p-2 bg-red-50 text-red-600 rounded text-sm font-mono whitespace-nowrap overflow-x-auto">
              {math}
            </pre>
          );
        }
      }

      // Inline math: starts and ends with $
      if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
        const math = part.slice(1, -1).trim();
        try {
          const html = katex.renderToString(math, {
            displayMode: false,
            throwOnError: false,
          });
          return (
            <span
              key={`inline-${index}`}
              className="inline-math mx-0.5 whitespace-nowrap inline-block align-middle max-w-full overflow-x-auto"
              style={{ whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'middle' }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch (e) {
          return (
            <code
              key={`err-inline-${index}`}
              className="text-red-500 font-mono text-xs whitespace-nowrap inline-block"
              style={{ whiteSpace: 'nowrap' }}
            >
              {math}
            </code>
          );
        }
      }

      // Standard text: preserve line breaks and parse interactive [[Fachbegriff]] wiki-links
      const textLines = part.split('\n');
      return (
        <span key={`text-${index}`}>
          {textLines.map((line, lineIdx) => {
            const termRegex = /\[\[(.*?)\]\]/g;
            const segments: React.ReactNode[] = [];
            let lastIndex = 0;
            let match: RegExpExecArray | null;

            while ((match = termRegex.exec(line)) !== null) {
              const textBefore = line.substring(lastIndex, match.index);
              if (textBefore) segments.push(textBefore);

              const term = match[1]?.trim() || '';
              const definition = getDefinition(term);

              segments.push(
                <button
                  key={`term-${index}-${lineIdx}-${match.index}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTermClick) {
                      onTermClick(term, definition);
                    } else {
                      setInternalGlossaryModal({ term, definition });
                    }
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/90 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 rounded-md cursor-pointer transition-all active:scale-95 shadow-2xs text-inherit align-baseline"
                  title={definition ? definition : `Fachbegriff: ${term}`}
                >
                  <span className="underline decoration-dotted decoration-indigo-500 dark:decoration-indigo-400 underline-offset-4 decoration-2">
                    {term}
                  </span>
                  <span className="text-[10px] text-indigo-500 dark:text-indigo-400 select-none opacity-80" aria-hidden="true">
                    ✨
                  </span>
                </button>
              );

              lastIndex = match.index + match[0].length;
            }

            const textAfter = line.substring(lastIndex);
            if (textAfter) segments.push(textAfter);

            return (
              <React.Fragment key={`line-${lineIdx}`}>
                {segments}
                {lineIdx < textLines.length - 1 && <br />}
              </React.Fragment>
            );
          })}
        </span>
      );
    });
  }, [content, glossary, onTermClick]);

  return (
    <div className={`leading-relaxed ${className}`}>
      {renderedElements}

      {/* Internal Modal Fallback if no external onTermClick is supplied */}
      {internalGlossaryModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setInternalGlossaryModal(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-indigo-200 dark:border-indigo-900/60 overflow-hidden flex flex-col animate-in zoom-in-95 sm:slide-in-from-bottom-2 duration-200 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-white/15 backdrop-blur-sm text-yellow-300">
                  <Sparkles className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-bold leading-tight">
                  {internalGlossaryModal.term}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInternalGlossaryModal(null)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                {internalGlossaryModal.definition ? (
                  <LaTeXRenderer content={internalGlossaryModal.definition} />
                ) : (
                  <p className="text-slate-500 italic">
                    Für diesen Begriff wurde noch keine Definition hinterlegt.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setInternalGlossaryModal(null)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
