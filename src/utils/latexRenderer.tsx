import React, { useMemo } from 'react';
import katex from 'katex';

interface LaTeXRendererProps {
  content: string;
  className?: string;
  glossary?: Record<string, string>;
  onTermClick?: (term: string, definition: string) => void;
}

/**
 * Parses markdown/plain text and renders embedded LaTeX expressions.
 * Handles both block math ($$...$$), inline math ($...$), and interactive [[Fachbegriffe]] (wiki-links).
 */
export const LaTeXRenderer: React.FC<LaTeXRendererProps> = ({
  content,
  className = '',
  glossary,
  onTermClick,
}) => {
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
              const definition = glossary?.[term] || '';

              segments.push(
                <button
                  key={`term-${index}-${lineIdx}-${match.index}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTermClick) {
                      onTermClick(term, definition);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-50/90 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 rounded-md border-b-2 border-dotted border-indigo-400 dark:border-indigo-400 cursor-pointer transition-all active:scale-95 shadow-2xs text-inherit align-baseline"
                  title={definition ? `Mini-Definition: ${definition}` : `Fachbegriff: ${term} (Tippen für Erklärung)`}
                >
                  <span className="underline decoration-dotted decoration-indigo-400 dark:decoration-indigo-400 underline-offset-3">
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

  return <div className={`leading-relaxed ${className}`}>{renderedElements}</div>;
};
