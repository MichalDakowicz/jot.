import '../lib/supabase';

import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
  JetBrainsMono_800ExtraBold,
  JetBrainsMono_400Regular_Italic,
  JetBrainsMono_800ExtraBold_Italic,
} from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, Appearance, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@jot/core/auth';
import { OnboardingProvider, useOnboarding } from '../lib/onboarding';
import { StoreProvider } from '@jot/core/store';
import { c, SELECTION } from '@jot/core/theme/tokens';

/** Sends you to onboarding, sign-in or the app, depending on what is known. */
function Gate() {
  const { ready, session, configured } = useAuth();
  const { seen } = useOnboarding();
  const segments = useSegments();
  const router = useRouter();

  const group = segments[0] as string | undefined;

  useEffect(() => {
    if (group === 'share' || group === 'auth') return;
    if (!configured) {
      if (group !== 'setup') router.replace('/setup');
      return;
    }
    if (!ready || seen === null) return;

    if (!session) {
      if (!seen) {
        if (group !== 'onboarding') router.replace('/onboarding');
      } else if (group !== 'sign-in' && group !== 'onboarding') {
        router.replace('/sign-in');
      }
      return;
    }
    if (group !== '(main)') router.replace('/today');
  }, [configured, ready, seen, session, group, router]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
    JetBrainsMono_800ExtraBold,
    JetBrainsMono_400Regular_Italic,
    JetBrainsMono_800ExtraBold_Italic,
  });

  // A browser has a selection colour of its own, and it is not the one the held
  // blocks are drawn in. `::selection` cannot be written as an inline style, so
  // it goes in as a rule of its own.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const rule = document.createElement('style');
    rule.textContent = `
      ::selection{background:${SELECTION.bg};color:${SELECTION.fg}}
      [data-jot-scrollbar="contents"]{
        scrollbar-width:thin;
        scrollbar-color:${c.n500} transparent;
      }
      [data-jot-scrollbar="contents"]::-webkit-scrollbar{width:8px;height:8px}
      [data-jot-scrollbar="contents"]::-webkit-scrollbar-track{background:transparent}
      [data-jot-scrollbar="contents"]::-webkit-scrollbar-thumb{
        background:${c.n500};border-radius:999px;
        border:2px solid transparent;background-clip:padding-box;
      }
      [data-jot-scrollbar="contents"]::-webkit-scrollbar-thumb:hover{background-color:${c.n700}}
      [data-jot-scrollbar="contents"]::-webkit-scrollbar-button{display:none}
      [data-jot-scrollbar="contents"]::-webkit-scrollbar-corner{background:transparent}
    `;
    document.head.appendChild(rule);
    return () => rule.remove();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={Appearance.getColorScheme() === 'dark' ? 'light' : 'dark'} />
      <AuthProvider>
        <StoreProvider>
          <OnboardingProvider>
            <View style={{ flex: 1, backgroundColor: c.bg }}>
              <Gate />
              <Slot />
            </View>
          </OnboardingProvider>
        </StoreProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
