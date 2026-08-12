import React from 'react';
import { listenForForegroundFcmMessages, summarizeForegroundFcmMessage } from '../lib/firebaseMessaging';

export default function FirebaseForegroundMessaging() {
  React.useEffect(() => {
    let unsubscribe = () => {};
    let mounted = true;

    listenForForegroundFcmMessages(
      (payload) => {
        if (process.env.NODE_ENV !== 'production') {
          console.info('[FCM] Foreground message received', summarizeForegroundFcmMessage(payload));
        }
      },
      (error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[FCM] Foreground messaging unavailable', error instanceof Error ? error.message : error);
        }
      }
    ).then((nextUnsubscribe) => {
      if (!mounted) {
        nextUnsubscribe();
        return;
      }
      unsubscribe = nextUnsubscribe;
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return null;
}