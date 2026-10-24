import React, { useRef, useState, useEffect } from 'react';
import { Unlock, AlertCircle } from 'lucide-react';

interface PinCodeInputProps {
  hintId: string;
  expectedPin: string;
  isError: boolean;
  onSubmit: (pin: string) => void;
  onClearError?: () => void;
}

/**
 * 4-Box Digit PIN Input Component
 * 
 * Features:
 * - One dedicated input box per digit [ ][ ][ ][ ]
 * - Numeric virtual keyboard on mobile (inputMode="numeric", pattern="[0-9]*")
 * - Strictly type="text" and non-credential attributes to eliminate password autofill suggestions
 *   ("Passwort vorschlagen") and browser "Passwort speichern?" prompts on smartphones
 * - Automatic focus advance on typing
 * - Backspace backward navigation and paste support (pasting 4 digits fills all boxes)
 * - Auto-submission upon entering the 4th digit
 */
export const PinCodeInput: React.FC<PinCodeInputProps> = ({
  hintId,
  expectedPin,
  isError,
  onSubmit,
  onClearError,
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // If error occurs, gently clear digits after delay and focus the first box
  useEffect(() => {
    if (isError) {
      const timer = setTimeout(() => {
        setDigits(['', '', '', '']);
        inputRefs.current[0]?.focus();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isError]);

  const handleChange = (index: number, value: string) => {
    if (onClearError) onClearError();

    // Keep only numbers
    const cleaned = value.replace(/\D/g, '');

    // Handle paste or multi-character entry
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, 4).split('');
      const newDigits = [...digits];
      chars.forEach((ch, i) => {
        if (i < 4) newDigits[i] = ch;
      });
      setDigits(newDigits);
      const nextFocus = Math.min(chars.length, 3);
      inputRefs.current[nextFocus]?.focus();

      if (chars.length === 4) {
        onSubmit(newDigits.join(''));
      }
      return;
    }

    const singleDigit = cleaned.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = singleDigit;
    setDigits(newDigits);

    // Auto-advance to next input box if a digit was entered
    if (singleDigit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 4 digits are completed
    if (singleDigit && index === 3) {
      const fullPin = newDigits.join('');
      if (fullPin.length === 4) {
        onSubmit(fullPin);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move back to previous box and clear it
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      const fullPin = digits.join('');
      if (fullPin.length === 4) {
        onSubmit(fullPin);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;

    const newDigits = ['', '', '', ''];
    pasted.split('').forEach((ch, idx) => {
      if (idx < 4) newDigits[idx] = ch;
    });
    setDigits(newDigits);

    const focusIdx = Math.min(pasted.length, 3);
    inputRefs.current[focusIdx]?.focus();

    if (pasted.length === 4) {
      onSubmit(newDigits.join(''));
    }
  };

  const isFull = digits.every((d) => d !== '');

  return (
    <div className="flex flex-col items-center gap-3.5 w-full">
      {/* 4 Separate Digit Boxes */}
      <div
        className={`flex items-center justify-center gap-2 sm:gap-3 py-1 ${
          isError ? 'animate-shake' : ''
        }`}
      >
        {digits.map((digit, idx) => (
          <input
            key={`box-${hintId}-${idx}`}
            ref={(el) => {
              inputRefs.current[idx] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            name={`pin-digit-${hintId.replace(/[^a-zA-Z0-9]/g, '')}-${idx}`}
            id={`pin-digit-${hintId.replace(/[^a-zA-Z0-9]/g, '')}-${idx}`}
            aria-label={`Ziffer ${idx + 1} des Zahlencodes`}
            className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl sm:text-3xl font-extrabold font-mono rounded-xl sm:rounded-2xl border-2 transition-all shadow-xs focus:outline-none ${
              isError
                ? 'border-red-500 text-red-600 bg-red-50/70 dark:bg-red-950/40 ring-2 ring-red-400 dark:ring-red-900'
                : digit
                ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 shadow-sm'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-slate-400 dark:hover:border-slate-600 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20'
            }`}
          />
        ))}
      </div>

      {/* Unlock Button & Feedback Message */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const fullPin = digits.join('');
            onSubmit(fullPin);
          }}
          disabled={!isFull}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer ${
            isFull
              ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-indigo-200 dark:shadow-none'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70'
          }`}
        >
          <Unlock className="w-4 h-4" />
          <span>Tipp freischalten</span>
        </button>

        {isError && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-semibold animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Falscher Code! Bitte noch einmal prüfen.</span>
          </div>
        )}
      </div>
    </div>
  );
};
