import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

import { apiUrl } from './api';

export type DateRange = { start: string; end: string }; // ISO yyyy-mm-dd

export type DailySummary = {
  date: string; // yyyy-mm-dd (local)
  totalMinutes: number;
  deepMinutes?: number;
  remMinutes?: number;
  sessionsCount?: number;
  avgHR?: number;
  hourlyBuckets?: { hour: number; minutes: number }[];
};

export type WeeklySummary = {
  weekStart: string; // yyyy-mm-dd
  weekEnd: string; // yyyy-mm-dd
  days: DailySummary[]; // length up to 7
  totalMinutes: number;
  avgHR?: number;
};

const CACHE_PREFIX = 'reports:daily:'; // per-user key prefix

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function lastNDates(n: number, fromDate = new Date()): string[] {
  const arr: string[] = [];
  const base = new Date(fromDate);
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    arr.push(toISODate(d));
  }
  return arr.reverse();
}

export function ensureRangeLimit(range: DateRange, maxDays = 15) {
  const start = new Date(range.start);
  const end = new Date(range.end);
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (diff > maxDays) throw new Error(`Range exceeds ${maxDays} days`);
}

async function getUserId(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem('user_id'));
  } catch {
    return null;
  }
}

async function getAuthToken(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem('auth_token'));
  } catch {
    return null;
  }
}

export async function fetchHistory(range: DateRange): Promise<any[]> {
  const token = await getAuthToken();
  try {
    const url = apiUrl(`/api/history?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json().catch(() => []);
    return Array.isArray(json) ? json : [];
  } catch (e) {
    console.warn('[ReportsService] fetchHistory failed, will rely on cache:', e);
    return [];
  }
}

// Normalize raw items into DailySummary per day (example shape; adapt when real API available)
export function normalizeToDaily(raw: any[]): Record<string, DailySummary> {
  const byDate: Record<string, DailySummary> = {};
  for (const item of raw) {
    // Attempt to read timestamp & metrics from a few possible shapes
    const t = Number(item?.timestamp ?? item?.time ?? Date.now());
    const d = new Date(isNaN(t) ? Date.now() : (t < 1e12 ? t * 1000 : t));
    const key = toISODate(d);

    const duration = Number(item?.durationMinutes ?? item?.duration ?? 0);
    const deep = Number(item?.deepMinutes ?? item?.deep ?? 0);
    const rem = Number(item?.remMinutes ?? item?.rem ?? 0);
    const hr = Number(item?.avgHR ?? item?.hr ?? NaN);

    if (!byDate[key]) byDate[key] = { date: key, totalMinutes: 0, deepMinutes: 0, remMinutes: 0, sessionsCount: 0, avgHR: 0, hourlyBuckets: [] };
    const s = byDate[key];
    s.totalMinutes += isNaN(duration) ? 0 : duration;
    s.deepMinutes = (s.deepMinutes ?? 0) + (isNaN(deep) ? 0 : deep);
    s.remMinutes = (s.remMinutes ?? 0) + (isNaN(rem) ? 0 : rem);
    s.sessionsCount = (s.sessionsCount ?? 0) + 1;
    if (!isNaN(hr)) {
      // simple running average
      const count = (s as any)._hrCount || 0;
      s.avgHR = ((s.avgHR || 0) * count + hr) / (count + 1);
      (s as any)._hrCount = count + 1;
    }
    // hourly bucket (best-effort)
    const hour = d.getHours();
    const bucket = s.hourlyBuckets?.find(b => b.hour === hour);
    if (bucket) bucket.minutes += isNaN(duration) ? 0 : duration;
    else s.hourlyBuckets?.push({ hour, minutes: isNaN(duration) ? 0 : duration });
  }

  // cleanup helper counters
  Object.values(byDate).forEach((v: any) => { if (typeof v._hrCount !== 'undefined') delete v._hrCount; });
  return byDate;
}

export async function upsertDailyCache(map: Record<string, DailySummary>): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const key = `${CACHE_PREFIX}${userId}`;
  try {
    const raw = await AsyncStorage.getItem(key);
    const prev = raw ? JSON.parse(raw) as Record<string, DailySummary> : {};
    const next = { ...prev, ...map } as Record<string, DailySummary>;
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch (e) {
    console.warn('[ReportsService] upsertDailyCache failed', e);
  }
}

export async function readDailyCache(dates: string[]): Promise<Record<string, DailySummary>> {
  const userId = await getUserId();
  if (!userId) return {};
  const key = `${CACHE_PREFIX}${userId}`;
  try {
    const raw = await AsyncStorage.getItem(key);
    const all = raw ? JSON.parse(raw) as Record<string, DailySummary> : {};
    const picked: Record<string, DailySummary> = {};
    dates.forEach(d => { if (all[d]) picked[d] = all[d]; });
    return picked;
  } catch {
    return {};
  }
}

export function computeWeeklySummary(dailies: DailySummary[], weekStart: string, weekEnd: string): WeeklySummary {
  const totalMinutes = dailies.reduce((acc, d) => acc += d.totalMinutes, 0);
  const hrVals = dailies.map(d => d.avgHR).filter(v => typeof v === 'number' && !isNaN(Number(v))) as number[];
  const avgHR = hrVals.length ? hrVals.reduce((a, b) => a + b, 0) / hrVals.length : undefined;
  return { weekStart, weekEnd, days: dailies, totalMinutes, avgHR };
}

export async function fetchAndCacheRange(range: DateRange): Promise<Record<string, DailySummary>> {
  const raw = await fetchHistory(range);
  const normalized = normalizeToDaily(raw);
  await upsertDailyCache(normalized);
  return normalized;
}

export async function getLast7Days(): Promise<Record<string, DailySummary>> {
  const days = lastNDates(7);
  const range: DateRange = { start: days[0], end: days[days.length - 1] };
  const fromCache = await readDailyCache(days);
  // Try network refresh in background; ignore errors
  fetchAndCacheRange(range).catch(() => {});
  return fromCache;
}

export function buildCsv(rows: DailySummary[]): string {
  const headers = ['Date', 'TotalMinutes', 'DeepMinutes', 'RemMinutes', 'Sessions', 'AvgHR'];
  const lines = [headers.join(',')];
  rows.forEach(r => {
    lines.push([
      r.date,
      Math.round(r.totalMinutes),
      Math.round(r.deepMinutes || 0),
      Math.round(r.remMinutes || 0),
      r.sessionsCount ?? 0,
      r.avgHR ? Math.round(r.avgHR) : ''
    ].join(','));
  });
  return lines.join('\n');
}

export async function exportCsv(range: DateRange, rows: DailySummary[]): Promise<string> {
  const csv = buildCsv(rows);
  const name = range.start === range.end ? `report_${range.start}.csv` : `report_${range.start}_to_${range.end}.csv`;
  const path = FileSystem.documentDirectory! + name;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
  return path;
}

export async function exportPdf(range: DateRange, rows: DailySummary[]): Promise<string> {
  const title = range.start === range.end ? `Report for ${range.start}` : `Report: ${range.start} → ${range.end}`;
  const tableRows = rows.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${Math.round(r.totalMinutes)}</td>
      <td>${Math.round(r.deepMinutes || 0)}</td>
      <td>${Math.round(r.remMinutes || 0)}</td>
      <td>${r.sessionsCount ?? 0}</td>
      <td>${r.avgHR ? Math.round(r.avgHR) : ''}</td>
    </tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8" /><style>
    body { font-family: -apple-system, Roboto, Arial, sans-serif; padding: 16px; }
    h1 { font-size: 18px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
    th { background: #f4f4f4; text-align: left; }
  </style></head><body>
    <h1>${title}</h1>
    <table>
      <thead><tr><th>Date</th><th>Total Minutes</th><th>Deep</th><th>REM</th><th>Sessions</th><th>Avg HR</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  return uri;
}


