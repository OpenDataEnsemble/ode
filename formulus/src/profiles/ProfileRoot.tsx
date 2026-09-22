import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { bootstrapProfileApp } from './ProfileBootstrap';
import { i18n } from '../i18n';
import { getProfileTransitionState, registerProfileTransitionHost, subscribeProfileTransition } from './ProfileTransitions';

export default function ProfileRoot(): React.JSX.Element {
  const [AppComponent, setAppComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<'bootstrap' | 'cold' | null>(null);
  const [unmounted, setUnmounted] = useState(false);
  const unmountAck = useRef<(() => void) | null>(null);
  const transition = useSyncExternalStore(subscribeProfileTransition, getProfileTransitionState);

  useEffect(() => {
    let cancelled = false;
    void bootstrapProfileApp().then(App => {
      if (!cancelled) setAppComponent(() => App);
    }).catch((failure: unknown) => {
      const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : null;
      if (!cancelled) setError(code === 'E_PROFILE_COLD_LAUNCH_REQUIRED' ? 'cold' : 'bootstrap');
      console.error('Profile bootstrap stopped; local data has not been reset.');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => registerProfileTransitionHost({
    unmount: () => new Promise<void>(resolve => {
      unmountAck.current = resolve;
      setUnmounted(true);
    }),
    restore: () => setUnmounted(false),
  }), []);

  useEffect(() => {
    if (unmounted && unmountAck.current) {
      const acknowledge = unmountAck.current;
      unmountAck.current = null;
      acknowledge();
    }
  }, [unmounted]);

  if (AppComponent && !unmounted && transition === 'idle' && !error) return <AppComponent />;
  const closeRequired = transition === 'close-required' || error === 'cold';
  const failed = error === 'bootstrap' || transition === 'commit-failed';
  return (
    <View style={styles.screen} accessibilityRole="alert">
      {!closeRequired && !failed && <ActivityIndicator size="large" />}
      <Text style={styles.title}>{i18n.t(closeRequired ? 'profiles.closeTitle' : failed ? 'profiles.recoveryTitle' : 'profiles.working', { defaultValue: 'Formulus profiles' })}</Text>
      <Text style={styles.message}>{i18n.t(closeRequired ? 'profiles.closeMessage' : failed ? 'profiles.recoveryMessage' : 'profiles.starting', { defaultValue: 'Preparing your profile. If startup fails, fully close and reopen Formulus. Do not clear app data.' })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#ffffff', gap: 16 },
  title: { fontSize: 22, fontWeight: '600', color: '#111111', textAlign: 'center' },
  message: { fontSize: 16, color: '#333333', textAlign: 'center' },
});
