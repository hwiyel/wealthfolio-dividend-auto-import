import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'dividend-assistant-ignored-items';

export function useIgnoredItems() {
  const [ignoredKeys, setIgnoredKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setIgnoredKeys(new Set(parsed));
        }
      }
    } catch (e) {
      console.error('Failed to load ignored items from localStorage', e);
    }
  }, []);

  const addIgnoredKey = useCallback((key: string) => {
    setIgnoredKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const removeIgnoredKey = useCallback((key: string) => {
    setIgnoredKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  return { ignoredKeys, addIgnoredKey, removeIgnoredKey };
}