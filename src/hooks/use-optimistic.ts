'use client';

import { useEffect, useRef, useState } from 'react';

const UNSET = Symbol('optimistic-unset');
const RESET_DELAY_MS = 5000;

export function useOptimisticValue<T>(serverValue: T) {
  const [optimisticState, setOptimisticState] = useState<
    | {
        baseValue: T;
        nextValue: T;
      }
    | typeof UNSET
  >(UNSET);
  const displayValue =
    optimisticState === UNSET ? serverValue : optimisticState.nextValue;

  if (
    optimisticState !== UNSET &&
    !Object.is(optimisticState.baseValue, serverValue)
  ) {
    setOptimisticState(UNSET);
  }

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const setOptimisticValue = (nextValue: T) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setOptimisticState({
      baseValue: serverValue,
      nextValue,
    });
    timeoutRef.current = setTimeout(() => {
      setOptimisticState(UNSET);
      timeoutRef.current = null;
    }, RESET_DELAY_MS);
  };

  return [displayValue, setOptimisticValue] as const;
}
