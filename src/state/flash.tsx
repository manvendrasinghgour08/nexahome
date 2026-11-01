import { Check } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/** Short, friendly "done" messages (e.g. "Good Night started") that confirm an action. Not saved anywhere. */
const FlashContext = createContext<(message: string) => void>(() => {});

export function FlashProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);
  const flash = useCallback((text: string) => setMessage({ text, id: Date.now() }), []);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(null), 2600);
    return () => window.clearTimeout(id);
  }, [message]);

  return (
    <FlashContext.Provider value={flash}>
      {children}
      <div className="flash-region" role="status" aria-live="polite">
        {message && (
          <div className="flash" key={message.id}>
            <Check size={18} /> {message.text}
          </div>
        )}
      </div>
    </FlashContext.Provider>
  );
}

export const useFlash = () => useContext(FlashContext);
