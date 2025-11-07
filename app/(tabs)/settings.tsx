import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Switch, StatusBar, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestNotifications } from 'react-native-permissions';
import { sendTestNotification } from '@/services/Notifications';

type RowProps = {
  title: string;
  subtitle?: string;
  valueText?: string;
  showToggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (next: boolean) => void;
  toggleDisabled?: boolean;
  onPress?: () => void;
};

function SectionHeader({ label }: { label: string }) {
  return (
    <Text style={styles.sectionHeader}>{label}</Text>
  );
}

function Row({ title, subtitle, valueText, showToggle, toggleValue, onToggle, toggleDisabled, onPress }: RowProps) {
  return (
    <TouchableOpacity activeOpacity={onPress ? 0.8 : 1} onPress={onPress} style={styles.row}>
      <View style={styles.rowTextContainer}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {showToggle ? (
        <Switch
          value={!!toggleValue}
          onValueChange={onToggle}
          disabled={!!toggleDisabled}
          trackColor={{ false: '#3A3F65', true: '#4A90E2' }}
          thumbColor={'#FFFFFF'}
        />
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isLoadingNotificationsPref, setIsLoadingNotificationsPref] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('notifications_enabled');
        setNotificationsEnabled(saved === 'true');
      } catch {}
      setIsLoadingNotificationsPref(false);
    })();
  }, []);

  const handleToggleNotifications = async (next: boolean) => {
    if (next) {
      try {
        const { status } = await requestNotifications(['alert', 'badge', 'sound']);
        const granted = status === 'granted' || status === 'limited';
        if (!granted) {
          Alert.alert('Permission required', 'Enable notifications in Settings to receive alerts.');
          setNotificationsEnabled(false);
          await AsyncStorage.setItem('notifications_enabled', 'false');
          return;
        }
        setNotificationsEnabled(true);
        await AsyncStorage.setItem('notifications_enabled', 'true');
        // Fire a test local notification to verify configuration
        await sendTestNotification('Hello, how was your sleep?');
      } catch (e) {
        Alert.alert('Error', 'Could not request notification permission.');
        setNotificationsEnabled(false);
        await AsyncStorage.setItem('notifications_enabled', 'false');
      }
    } else {
      setNotificationsEnabled(false);
      await AsyncStorage.setItem('notifications_enabled', 'false');
    }
  };
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#02041A" />
      <LinearGradient colors={['#1D244D', '#02041A', '#1A1D3E']} style={styles.gradientBackground} />

      {/* Header (match History style) */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}> 
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 56 }]} showsVerticalScrollIndicator={false}>
        {/* Account */}
        <SectionHeader label="Account" />
        <View style={styles.card}>
          <Row title="Refresh profile" />
          <View style={styles.divider} />
          <Row title="Sign out" />
        </View>

        {/* Reports & Export */}
        <SectionHeader label="Reports & Export" />
        <View style={styles.card}>
          <Row title="View reports" onPress={() => router.push('/reports')} />
          <View style={styles.divider} />
          <Row title="Export data" onPress={() => router.push('/reports/export')} />
        </View>

        {/* Devices & Connections */}
        <SectionHeader label="Devices & Connections" />
        <View style={styles.card}>
          <Row title="Manage Bluetooth devices" />
          <View style={styles.divider} />
          <Row title="Scan / connect to device" />
          <View style={styles.divider} />
          <Row title="Device Wi‑Fi setup" />
          <View style={styles.divider} />
          <Row title="Device AP IP (advanced)" />
        </View>

        {/* Permissions & Privacy */}
        <SectionHeader label="Permissions & Privacy" />
        <View style={styles.card}>
          <Row
            title="Notifications"
            subtitle="Enable app alerts and updates"
            showToggle
            toggleValue={notificationsEnabled}
            toggleDisabled={isLoadingNotificationsPref}
            onToggle={handleToggleNotifications}
          />
          <View style={styles.divider} />
          <Row title="Bluetooth permissions" />
          <View style={styles.divider} />
          <Row title="Location permission" />
          <View style={styles.divider} />
          <Row title="Privacy Policy" />
          <View style={styles.divider} />
          <Row title="Terms of Service" />
        </View>

        {/* Units & Preferences */}
        <SectionHeader label="Units & Preferences" />
        <View style={styles.card}>
          <Row title="Height unit" valueText="cm / inch" />
          <View style={styles.divider} />
          <Row title="Weight unit" valueText="kg / lb" />
          <View style={styles.divider} />
          <Row title="Waist unit" valueText="cm / inch" />
          <View style={styles.divider} />
          <Row title="Start of the week" valueText="Sunday" />
        </View>

        {/* Diagnostics */}
        <SectionHeader label="Diagnostics" />
        <View style={styles.card}>
          <Row title="Configure diagnostics" subtitle="Reports include usage details" />
          <View style={styles.divider} />
          <Row title="Share logs / Wi‑Fi test" />
        </View>

        {/* Data & Storage */}
        <SectionHeader label="Data & Storage" />
        <View style={styles.card}>
          <Row title="Clear cached profile" />
          <View style={styles.divider} />
          <Row title="Clear device history" />
        </View>

        {/* About */}
        <SectionHeader label="About" />
        <View style={styles.card}>
          <Row title="App version / Build" />
          <View style={styles.divider} />
          <Row title="Contact support" />
        </View>
        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02041A' },
  gradientBackground: { position: 'absolute', width: '100%', height: '100%' },
  header: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  sectionHeader: { color: '#8F96C2', fontSize: 12, letterSpacing: 0.6, marginTop: 16, marginBottom: 8, fontWeight: '600' },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowTextContainer: { flexShrink: 1, paddingRight: 12 },
  rowTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  rowSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  chevron: { color: 'rgba(255,255,255,0.5)', fontSize: 22, marginLeft: 8 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 16 },
});

