import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Canvas, Path, Skia, vec, Group, Rect, LinearGradient as SkiaLinearGradient } from '@shopify/react-native-skia';

const { width } = Dimensions.get('window');
const CHART_HORIZONTAL_PADDING = 16;
const CHART_TOP = 80;
const CHART_BOTTOM = 80;
const CHART_WIDTH = width - CHART_HORIZONTAL_PADDING * 2;
const CHART_HEIGHT = 240;

type Point = { x: number; y: number };

function generateMockTempSeries(count = 240, base = 22.5) {
  const points: { t: number; v: number }[] = [];
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const t = now - i * 60_000; // 1-minute steps
    const wave = Math.sin((i / 24) * Math.PI * 2) * 0.6; // smooth diurnal-like
    const noise = (Math.random() - 0.5) * 0.25;
    const drift = (i / count) * 0.3; // small trend
    const v = base + wave + noise - drift;
    points.push({ t, v: Number(v.toFixed(2)) });
  }
  return points;
}

function buildPath(data: { t: number; v: number }[], frame: { x: number; y: number; w: number; h: number }) {
  if (!data.length) return Skia.Path.Make();
  const xs = data.map((d) => d.t);
  const ys = data.map((d) => d.v);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = Math.max(1, maxX - minX);
  const rangeY = Math.max(0.0001, maxY - minY);

  const toPoint = (d: { t: number; v: number }): Point => {
    const nx = (d.t - minX) / rangeX; // 0..1
    const ny = (d.v - minY) / rangeY; // 0..1
    const x = frame.x + nx * frame.w;
    const y = frame.y + frame.h - ny * frame.h; // invert y
    return { x, y };
  };

  const path = Skia.Path.Make();
  const first = toPoint(data[0]);
  path.moveTo(first.x, first.y);
  for (let i = 1; i < data.length; i++) {
    const p = toPoint(data[i]);
    path.lineTo(p.x, p.y);
  }
  return path;
}

export default function TemperatureChartScreen() {
  const router = useRouter();
  const [series] = React.useState(() => generateMockTempSeries());

  const frame = React.useMemo(
    () => ({ x: CHART_HORIZONTAL_PADDING, y: CHART_TOP, w: CHART_WIDTH, h: CHART_HEIGHT }),
    []
  );

  const path = React.useMemo(() => buildPath(series, frame), [series, frame]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1D244D', '#02041A', '#1A1D3E']} style={StyleSheet.absoluteFill} />

      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Temperature</Text>
        <View style={{ width: 64 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Last 4 Hours (mock)</Text>

        <Canvas style={{ width, height: CHART_TOP + CHART_HEIGHT + CHART_BOTTOM }}>
          {/* Background panel gradient */}
          <Group>
            <Rect x={12} y={CHART_TOP - 12} width={width - 24} height={CHART_HEIGHT + 24} r={14} color="#0B0E2A" />
            <SkiaLinearGradient
              start={vec(12, CHART_TOP - 12)}
              end={vec(width - 12, CHART_TOP + CHART_HEIGHT + 12)}
              colors={["rgba(126,166,255,0.12)", "rgba(126,166,255,0.02)"]}
            />
          </Group>

          {/* Grid lines */}
          {Array.from({ length: 5 }).map((_, i) => {
            const y = frame.y + (i * frame.h) / 4;
            const grid = Skia.Path.Make();
            grid.moveTo(frame.x, y);
            grid.lineTo(frame.x + frame.w, y);
            return <Path key={`g-${i}`} path={grid} color="rgba(255,255,255,0.12)" strokeWidth={1} style="stroke" />;
          })}

          {/* Area under line (soft glow) */}
          {(() => {
            const area = Skia.Path.Make();
            if (series.length === 0) return null;
            // build same path, then close to bottom to create fill
            const xs = series.map((d) => d.t);
            const ys = series.map((d) => d.v);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const rangeX = Math.max(1, maxX - minX);
            const rangeY = Math.max(0.0001, maxY - minY);
            const toPoint = (d: { t: number; v: number }): Point => {
              const nx = (d.t - minX) / rangeX;
              const ny = (d.v - minY) / rangeY;
              const x = frame.x + nx * frame.w;
              const y = frame.y + frame.h - ny * frame.h;
              return { x, y };
            };
            const first = toPoint(series[0]);
            area.moveTo(first.x, first.y);
            for (let i = 1; i < series.length; i++) {
              const p = toPoint(series[i]);
              area.lineTo(p.x, p.y);
            }
            area.lineTo(frame.x + frame.w, frame.y + frame.h);
            area.lineTo(frame.x, frame.y + frame.h);
            area.close();
            return (
              <Group>
                <Path path={area} color="rgba(126,166,255,0.18)" style="fill" />
              </Group>
            );
          })()}

          {/* Line */}
          <Path path={path} color="#7EA6FF" strokeWidth={2.5} style="stroke" />
        </Canvas>

        <View style={styles.legendRow}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>Room Temperature (°C)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02041A' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 10,
  },
  backBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.10)'
  },
  backText: { color: '#FFFFFF', fontWeight: '800' },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  card: {
    margin: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  subtitle: { color: '#B7C2FF', fontSize: 12, fontWeight: '700', padding: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 14 },
  legendDot: { width: 10, height: 10, borderRadius: 6, backgroundColor: '#7EA6FF', marginRight: 8 },
  legendText: { color: 'rgba(255,255,255,0.85)', fontWeight: '700' },
});


