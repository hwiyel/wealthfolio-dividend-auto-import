import { useState, useCallback, useEffect } from 'react';
import type { AddonContext } from '@wealthfolio/addon-sdk';

const STORAGE_KEY = 'ignored-items';

// Typed accessor for the host storage API (baseline capability, no permission needed).
// The current SDK type definitions omit StorageAPI; access it via a cast.
function getStorage(ctx: AddonContext) {
  return (ctx.api as any).storage as {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
}

export function useIgnoredItems(ctx: AddonContext) {
  const [ignoredKeys, setIgnoredKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    getStorage(ctx)
      .get(STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setIgnoredKeys(new Set(parsed));
          }
        }
      })
      .catch((e) => {
        ctx.api.logger.error('Failed to load ignored items: ' + String(e));
      });
  }, [ctx]);

  const addIgnoredKey = useCallback((key: string) => {
    setIgnoredKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      getStorage(ctx).set(STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, [ctx]);

  const removeIgnoredKey = useCallback((key: string) => {
    setIgnoredKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      getStorage(ctx).set(STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, [ctx]);

  return { ignoredKeys, addIgnoredKey, removeIgnoredKey };
}