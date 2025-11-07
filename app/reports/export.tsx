import React from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import type { DateRange, DailySummary } from '@/types/Reports';
import { ensureRangeLimit, lastNDates, readDailyCache, exportCsv, exportPdf } from '@/services/ReportsService';

export default function ExportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const today = lastNDates(1)[0];
  const week = lastNDates(7);
  const [status, setStatus] = React.useState<string>('');

  const runExport = async (fmt: 'csv' | 'pdf', range: DateRange) => {
    try {
      ensureRangeLimit(range, 15);
      const days = [] as string[];
      const start = new Date(range.start);
      const end = new Date(range.end);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0');
        days.push(`${y}-${m}-${day}`);
      }
      const map = await readDailyCache(days); // export from cached data
      const rows: DailySummary[] = days.map(d => map[d]).filter(Boolean) as DailySummary[];
      if (rows.length === 0) { setStatus('No cached data for this range. Open Reports first to sync.'); return; }
      const p = fmt === 'csv' ? await exportCsv(range, rows) : await exportPdf(range, rows);
      setStatus(`Saved to: ${p}`);
    } catch (e: any) {
      setStatus(e?.message || 'Export failed');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#02041A" />
      <LinearGradient colors={['#1D244D', '#02041A', '#1A1D3E']} style={styles.gradientBackground} />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}> 
        <Text style={styles.headerTitle}>Export</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn}><Text style={styles.headerIconText}>Close</Text></TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Text style={styles.section}>Quick ranges</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => runExport('csv', { start: today, end: today })}><Text style={styles.btnText}>Day CSV</Text></TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => runExport('pdf', { start: today, end: today })}><Text style={styles.btnText}>Day PDF</Text></TouchableOpacity>
        </View>
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => runExport('csv', { start: week[0], end: week[6] })}><Text style={styles.btnText}>Week CSV</Text></TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => runExport('pdf', { start: week[0], end: week[6] })}><Text style={styles.btnText}>Week PDF</Text></TouchableOpacity>
        </View>

        <Text style={styles.note}>Custom ranges up to 15 days are supported. Use the Reports screen to select and sync the dates you want, then export here (exports use cached data when offline).</Text>
        {!!status && <Text style={styles.status}>{status}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02041A' },
  gradientBackground: { position: 'absolute', width: '100%', height: '100%' },
  header: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  headerIconBtn: { marginLeft: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.10)' },
  headerIconText: { color: '#C7B9FF', fontWeight: '800' },
  section: { color: '#C7D6FF', fontWeight: '800', marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  btn: { flex: 1, marginHorizontal: 4, backgroundColor: '#7EA6FF', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#0F112B', fontWeight: '900' },
  note: { color: 'rgba(255,255,255,0.8)', marginTop: 10 },
  status: { color: '#C7D6FF', marginTop: 10 },
});


