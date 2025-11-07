import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Display notifications when received in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    vibrationPattern: [200, 100, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function sendTestNotification(message: string = 'Hello, how was your sleep?'): Promise<void> {
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Dozemate',
      body: message,
      sound: 'default',
    },
    // null triggers immediately
    trigger: null,
  });
}


