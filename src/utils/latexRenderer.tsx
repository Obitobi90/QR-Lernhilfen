import React, { useMemo } from 'react';
import katex from 'katex';

interface LaTeXRendererProps {
  content: string;
  className?: string;
}

/**
 * Parses markdown/plain text and renders embedded LaTeX expressions.
 * Handles both block math: $$formula$$
 * and inline math: $formula$
 */
export const LaTeXRenderer: React.FC<LaTeXRendererProps> = ({ content, className = '' }) => {
  const renderedElements = useMemo(() => {
    if (!content) return null;

    // Tokenize text into parts: block math ($$...$$), inline math ($...$), and standard text
    // Regex matches $$...$$ or $...$ (ignoring escaped \$)
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
              className="my-3 overflow-x-auto text-center"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch (e) {
          return (
            <pre key={`err-block-${index}`} className="my-2 p-2 bg-red-50 text-red-600 rounded text-sm font-mono">
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
              className="inline-math mx-0.5"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch (e) {
          return (
            <code key={`err-inline-${index}`} className="text-red-500 font-mono text-xs">
              {math}
            </code>
          );
        }
      }

      // Standard text: preserve line breaks
      const textLines = part.split('\n');
      return (
        <span key={`text-${index}`}>
          {textLines.map((line, lineIdx) => (
            <React.Fragment key={`line-${lineIdx}`}>
              {line}
              {lineIdx < textLines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </span>
      );
    });
  }, [content]);

  return <div className={`leading-relaxed ${className}`}>{renderedElements}</div>;
};
