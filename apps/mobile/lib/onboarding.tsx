import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'marginalia.onboarded';

type Value = { seen: boolean | null; markSeen: () => Promise<void> };

const OnboardingContext = createContext<Value>({ seen: null, markSeen: async () => {} });

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setSeen(v === '1'))
      .catch(() => setSeen(false));
  }, []);

  const value = useMemo<Value>(
    () => ({
      seen,
      async markSeen() {
        setSeen(true);
        await AsyncStorage.setItem(KEY, '1').catch(() => {});
      },
    }),
    [seen],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export const useOnboarding = () => useContext(OnboardingContext);
