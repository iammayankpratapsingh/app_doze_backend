import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import Svg from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Modal } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RNSvg = require('react-native-svg');
const { Circle, Path } = RNSvg as { Circle: any; Path: any };
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width * 0.72 + 16;
const CIRCLE_SIZE = 160;
const STROKE_WIDTH = 10;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const MOCK_SLEEP = {
  score: 59,
  date: new Date(),
  metrics: [
    { label: 'Duration', value: '5H 57M', iconName: 'time-outline' },
    { label: 'Heart Rate', value: '63BPM', iconName: 'heart' },
    { label: 'Respiration', value: '18RPM', iconName: 'speedometer-outline' },
    { label: 'Efficiency', value: '56%', iconName: 'trending-up-outline' },
  ],
};

const MOCK_MEDITATIONS = [
  {
    id: '1',
    title: 'Druvbbal',
    subtitle: 'Instant Stress & Anxiety Buster',
    duration: '6 Min',
    image: require('../../assets/images/partial-react-logo.png'),
  },
  {
    id: '2',
    title: 'Calm Focus',
    subtitle: 'Deep focus in minutes',
    duration: '8 Min',
    image: require('../../assets/images/react-logo.png'),
  },
  {
    id: '3',
    title: 'Breath Ease',
    subtitle: 'Release tension gently',
    duration: '5 Min',
    image: require('../../assets/images/icon.png'),
  },
];

// small util: generate sample sparkline points
function genSparklinePoints(widthPx = 120, heightPx = 28, count = 10, min = 0, max = 100) {
  const values = Array.from({ length: count }, () => Math.random() * (max - min) + min);
  const stepX = widthPx / (count - 1);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = heightPx - ((v - minVal) / range) * heightPx;
    return `${x},${y}`;
  });
  return { svgPoints: points.join(' '), raw: values };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const router = useRouter();
  const [sleepDate, setSleepDate] = React.useState(MOCK_SLEEP.date);
  const [isDatePickerVisible, setDatePickerVisible] = React.useState(false);
  const [displayScore, setDisplayScore] = React.useState(0);
  const [isSwitcherOpen, setSwitcherOpen] = React.useState(false);
  const [isEnvExpanded, setEnvExpanded] = React.useState(false);

  const carouselRef = React.useRef<ScrollView | null>(null);
  const loopData = React.useMemo(() => {
    const first = MOCK_MEDITATIONS[0];
    const last = MOCK_MEDITATIONS[MOCK_MEDITATIONS.length - 1];
    return [last, ...MOCK_MEDITATIONS, first];
  }, []);
  const [carouselIndex, setCarouselIndex] = React.useState(1);
  const autoplayRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    requestAnimationFrame(() => {
      carouselRef.current?.scrollTo({ x: ITEM_WIDTH * 1, y: 0, animated: false });
    });

    autoplayRef.current = setInterval(() => {
      setCarouselIndex((prev) => {
        const next = prev + 1;
        carouselRef.current?.scrollTo({ x: ITEM_WIDTH * next, y: 0, animated: true });
        return next;
      });
    }, 3000);
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const formattedDate = React.useMemo(() => {
    const d = sleepDate;
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    return isToday ? 'Today' : d.toLocaleDateString();
  }, [sleepDate]);

  const progressAnim = React.useRef(new Animated.Value(0)).current;
  const scoreAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(progressAnim, {
        toValue: MOCK_SLEEP.score / 100,
        duration: 1000,
        useNativeDriver: false,
      }),
      Animated.timing(scoreAnim, {
        toValue: MOCK_SLEEP.score,
        duration: 1000,
        useNativeDriver: false,
      }),
    ]).start();

    const id = scoreAnim.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });
    return () => scoreAnim.removeListener(id);
  }, [progressAnim, scoreAnim]);

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  const activeName = auth.user?.name || auth.user?.email || 'User';
  const activeEmail = auth.user?.email || '';
  const initials = React.useMemo(() => {
    const base = activeName.trim() || activeEmail.trim();
    if (!base) return 'U';
    const parts = base.split(' ');
    const first = parts[0]?.[0] || base[0];
    const second = parts.length > 1 ? parts[1]?.[0] : '';
    return (first + (second || '')).toUpperCase();
  }, [activeName, activeEmail]);

  // Data for environment section
   const baseMetrics = React.useMemo(
     () => [
       { key: 'temp', name: 'Temperature', value: '22.5', unit: '°C', icon: '🌡️', colors: ['#2B2E57', '#1B1E3D'] as const },
       { key: 'hum', name: 'Humidity', value: '48', unit: '%', icon: '💧', colors: ['#24425F', '#18253A'] as const },
       { key: 'press', name: 'Pressure', value: '1013', unit: 'hPa', icon: '🔽', colors: ['#2B3E56', '#172235'] as const },
       { key: 'batt', name: 'Battery', value: '76', unit: '%', icon: '🔋', colors: ['#2A4A3E', '#153127'] as const },
     ],
     []
   );

   const extraMetrics = React.useMemo(
     () => [
       { key: 'iaq', name: 'IAQ', value: '78', unit: '', icon: '🌬️', colors: ['#3A2C59', '#1D1430'] as const },
       { key: 'bvoc', name: 'bVOC', value: '220', unit: 'ppb', icon: '🧪', colors: ['#2B3054', '#161A33'] as const },
       { key: 'eco2', name: 'eCO₂', value: '650', unit: 'ppm', icon: '🫧', colors: ['#29334D', '#121A2A'] as const },
       { key: 'tvoc', name: 'TVOC', value: '120', unit: 'ppb', icon: '☁️', colors: ['#2F2E4A', '#17162A'] as const },
       { key: 'gas', name: 'Gas', value: '--', unit: '', icon: '🔥', colors: ['#2B2F3F', '#161925'] as const },
     ],
     []
   );

  // pre-generate small sparkline points for each metric (for demo)
  const sparklines = React.useMemo(() => {
    const all = [...baseMetrics, ...extraMetrics];
    const map: Record<string, { svgPoints: string; raw: number[] }> = {};
    all.forEach((m) => {
      map[m.key] = genSparklinePoints(120, 28, 12, 0, 100);
    });
    return map;
  }, [baseMetrics, extraMetrics]);

  const onToggleEnv = () => {
    // configure LayoutAnimation for smoother expand/collapse
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEnvExpanded((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#02041A" />
      <LinearGradient colors={['#1D244D', '#02041A', '#1A1D3E']} style={styles.gradientBackground} />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        {/* --- Sleep Card --- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Your Sleep</Text>
            <TouchableOpacity
              style={styles.avatarPill}
              onPress={() => setSwitcherOpen(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.dateCenter} onPress={() => setDatePickerVisible(true)}>
            <Text style={styles.dateCenterText}>{formattedDate}</Text>
          </TouchableOpacity>

          {/* ---- Circular Progress ---- */}
          <View style={styles.gaugeContainer}>
            <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
              {/* Background track */}
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={RADIUS}
                stroke="rgba(126,166,255,0.18)"
                strokeWidth={STROKE_WIDTH}
                fill="none"
              />
              {/* Progress arc */}
              <AnimatedCircle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={RADIUS}
                stroke="#7EA6FF"
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={`${CIRCUMFERENCE}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                rotation={-90}
                originX={CIRCLE_SIZE / 2}
                originY={CIRCLE_SIZE / 2}
              />
            </Svg>

            <View style={styles.centerTextContainer}>
              <Text style={styles.gaugeScore}>{displayScore}</Text>
              <Text style={styles.gaugeCaption}>Sleep Score</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            {MOCK_SLEEP.metrics.map((m) => (
              <View key={m.label} style={styles.metricItem}>
                <Ionicons name={m.iconName as any} size={18} color="#C7D6FF" />
                <Text style={styles.metricValue}>{m.value}</Text>
                <Text style={styles.metricLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* --- Environment Data (NEW Grid + Sparklines) --- */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Environment Data</Text>
        </View>

        <View style={styles.envCard}>
          {/* container for grid */}
          <View style={styles.envGrid}>
            {(() => {
              const items = isEnvExpanded ? [...baseMetrics, ...extraMetrics] : baseMetrics;
              // split into rows of 2 (flex: 1 ensures consistent widths; marginHorizontal provides gaps)
              const rows = [];
              for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
              return rows.map((pair, rowIndex) => (
                <View key={`env-row-${rowIndex}`} style={styles.envRow}>
                  {pair.map((m) => {
                    const spark = sparklines[m.key] || genSparklinePoints(120, 28, 12);
                    const Container: any = m.key === 'temp' ? TouchableOpacity : View;
                    return (
                      <Container
                        key={m.key}
                        style={styles.envTile}
                        {...(m.key === 'temp'
                          ? { activeOpacity: 0.85, onPress: () => router.push('/charts/temperature') }
                          : {})}
                      >
                        <LinearGradient colors={m.colors} style={styles.envTileBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                        <View style={styles.envTileInner}>
                          <View style={styles.envTopRow}>
                            <View style={[styles.envIconWrap, { marginRight: 4 }]}>
                              <Text style={styles.envIcon}>{m.icon}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.envName} numberOfLines={1} ellipsizeMode="tail">{m.name}</Text>
                            </View>
                            {/* small status dot (color-coded) */}
                            <View style={[styles.statusDot, { backgroundColor: m.key === 'batt' ? '#7EE3A1' : '#7EA6FF' }]} />
                          </View>

                          <View style={styles.envValueRow}>
                            <Text style={styles.envValueNum}>{m.value}</Text>
                            <Text style={styles.envUnit}>{m.unit ? ` ${m.unit}` : ''}</Text>
                          </View>

                          {/* mini sparkline */}
                           <View style={styles.sparklineWrap}>
                             <Svg height={28} width={120}>
                               {(() => {
                                 const pts = spark.svgPoints.split(' ');
                                 if (!pts.length) return null;
                                 const d = `M ${pts[0]} L ${pts.slice(1).join(' L ')}`;
                                 return (
                                   <Path
                                     d={d}
                                     fill="none"
                                     stroke="rgba(255,255,255,0.9)"
                                     strokeWidth={2}
                                     strokeLinecap="round"
                                     strokeLinejoin="round"
                                     opacity={0.95}
                                   />
                                 );
                               })()}
                             </Svg>
                          </View>
                        </View>
                      </Container>
                    );
                  })}

                  {/* if only one item in row and expanded, render a spacer to keep layout stable */}
                  {pair.length === 1 ? <View style={[styles.envTile, styles.emptyTile]} /> : null}
                </View>
              ));
            })()}
          </View>

          <View style={styles.viewMoreBtnContainer}>
            <LinearGradient colors={['#7EA6FF', 'rgba(126,166,255,0.4)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.viewMoreGradient}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.viewMoreBtn}
                onPress={onToggleEnv}
              >
                <Text style={styles.viewMoreText}>{isEnvExpanded ? 'View Less' : 'View More'}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>

        {/* --- rest of screen --- */}
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>My Health</Text>
        <TouchableOpacity style={styles.listItem}>
          <View style={styles.listIconTile}>
            <LinearGradient colors={['#283048', '#859398']} style={styles.listIconBg} />
          </View>
          <Text style={styles.listTitle}>Sleep Scores</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* --- Health Summary (Quick Stats) --- */}
        <View style={styles.healthCard}>
          {/* Heart Rate */}
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Heart Rate</Text>
            <View style={styles.healthBar}>
              <View style={styles.healthTrack} />
              <View style={[styles.healthFill, { width: '60%', backgroundColor: '#7EA6FF' }]} />
            </View>
            <Text style={styles.healthValue}>66 BPM</Text>
          </View>

          {/* Respiration Rate */}
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Respiration Rate</Text>
            <View style={styles.healthBar}>
              <View style={styles.healthTrack} />
              <View style={[styles.healthFill, { width: '40%', backgroundColor: '#BA8CFF' }]} />
            </View>
            <Text style={styles.healthValue}>16 RPM</Text>
          </View>

          {/* Sleep */}
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Sleep</Text>
            <View style={styles.healthBar}>
              <View style={styles.healthTrack} />
              <View style={[styles.healthFill, { width: '70%', backgroundColor: '#7EE3A1' }]} />
            </View>
            <Text style={styles.healthValue}>8 HRS 24 MIN</Text>
          </View>

          {/* Stress (HRV) */}
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Stress (HRV)</Text>
            <View style={styles.healthBar}>
              <View style={styles.healthTrack} />
              <View style={[styles.healthFill, { width: '50%', backgroundColor: '#FFA76B' }]} />
            </View>
            <Text style={styles.healthValue}>Moderate (60)</Text>
          </View>

          {/* Environment */}
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Environment</Text>
            <View style={styles.healthBar}>
              <View style={styles.healthTrack} />
              <View style={[styles.healthFill, { width: '65%', backgroundColor: '#7EE3A1' }]} />
            </View>
            <Text style={styles.healthValue}>Moderate</Text>
          </View>

          {/* Wakeup Feel */}
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Wakeup Feel</Text>
            <View style={styles.healthBar}>
              <View style={styles.healthTrack} />
              <View style={[styles.healthFill, { width: '85%', backgroundColor: '#7EA6FF' }]} />
            </View>
            <Text style={styles.healthValue}>Great</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        date={sleepDate}
        onConfirm={(d) => {
          setSleepDate(d);
          setDatePickerVisible(false);
        }}
        onCancel={() => setDatePickerVisible(false)}
      />

      {/* Profile Switcher Modal */}
      <Modal
        visible={isSwitcherOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSwitcherOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={() => setSwitcherOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetAvatarLg}>
                <Text style={styles.avatarLgText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetGreeting}>Hi, {activeName}!</Text>
                {!!activeEmail && <Text style={styles.sheetEmail}>{activeEmail}</Text>}
              </View>
            </View>

            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() => {
                setSwitcherOpen(false);
                router.push('/(tabs)/profile');
              }}
            >
              <Text style={styles.manageText}>Manage your Account</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Accounts list: currently only active account */}
            <TouchableOpacity style={styles.accountRow} activeOpacity={0.8}>
              <View style={styles.accountAvatarSm}>
                <Text style={styles.avatarSmText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountName}>{activeName}</Text>
                {!!activeEmail && <Text style={styles.accountEmail}>{activeEmail}</Text>}
              </View>
              <Text style={styles.activeMark}>✓</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addAccountRow}
              onPress={() => {
                setSwitcherOpen(false);
                router.push('/(authentication)/signin');
              }}
            >
              <Text style={styles.addAccountText}>Add another account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.manageDeviceRow}
              onPress={() => {
                setSwitcherOpen(false);
                router.push('/(tabs)/profile');
              }}
            >
              <Text style={styles.manageDeviceText}>Manage accounts on this device</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02041A' },
  gradientBackground: { position: 'absolute', width: '100%', height: '100%' },
  scrollContent: { paddingTop: 56, paddingHorizontal: 16 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  infoPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  infoText: { color: '#FFF', fontWeight: '700' },
  dateCenter: { alignItems: 'center', marginVertical: 8 },
  dateCenterText: { color: '#B7C2FF', fontSize: 14, fontWeight: '700' },
  gaugeContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  centerTextContainer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  gaugeScore: { color: '#FFF', fontSize: 36, fontWeight: '800' },
  gaugeCaption: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  metricItem: { alignItems: 'center', width: (width - 16 * 2 - 12 * 3) / 4 },
  metricIcon: { width: 18, height: 18, marginBottom: 6, opacity: 0.8 },
  metricValue: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  metricLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
  sectionHeaderRow: {
    marginTop: 20,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  viewAll: { color: '#7EA6FF', fontWeight: '700' },
  carouselContent: { paddingVertical: 8, paddingRight: 16 },
  meditationCard: {
    width: width * 0.72,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  meditationImage: { height: 120, alignItems: 'center', justifyContent: 'center' },
  meditationThumb: { width: 72, height: 72, opacity: 0.9 },
  meditationTextBlock: { padding: 12 },
  meditationTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  meditationSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  meditationMeta: { color: '#B7C2FF', fontSize: 12, marginTop: 6, fontWeight: '700' },

  // Environment panel styles (updated)
  envCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  envGrid: {
    // parent container for rows
    width: '100%',
  },
  envRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  envTile: {
    flex: 1, // take equal width
    minHeight: 110,
    borderRadius: 14,
    overflow: 'hidden',
    marginHorizontal: 6, // gap between tiles
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyTile: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    opacity: 0,
  },
  envTileBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.22,
  },
  envTileInner: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, justifyContent: 'space-between' },
  envTopRow: { flexDirection: 'row', alignItems: 'center' },
  envIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  envIcon: { fontSize: 16 },
  envName: { color: 'rgba(255,255,255,0.95)', fontSize: 13, fontWeight: '700', marginLeft: 4, flexShrink: 1 },
  envValueRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 },
  envValueNum: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  envUnit: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '700', marginLeft: 6, marginBottom: 2 },
  sparklineWrap: { marginTop: 8, alignItems: 'flex-start' },
  statusDot: { width: 10, height: 10, borderRadius: 6, marginLeft: 8 },

  viewMoreBtnContainer: { marginTop: 6 },
  viewMoreGradient: {
    borderRadius: 12,
    padding: 2,
    shadowColor: '#7EA6FF',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  viewMoreBtn: {
    backgroundColor: 'rgba(2,4,26,0.9)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  viewMoreText: { color: '#FFFFFF', fontWeight: '800', marginRight: 8 },
  chevWrap: { marginLeft: 6 },
  chev: { color: '#C7D6FF', fontSize: 16 },

  listItem: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  listIconTile: { width: 36, height: 36, borderRadius: 8, overflow: 'hidden', marginRight: 12 },
  listIconBg: { width: '100%', height: '100%' },
  listTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', flex: 1 },
  chevron: { color: 'rgba(255,255,255,0.8)', fontSize: 22, marginLeft: 8 },

  healthCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  healthRow: {
    marginBottom: 16,
  },
  healthLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  healthBar: {
    height: 8,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  healthTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
  },
  healthFill: {
    height: 8,
    borderRadius: 8,
  },
  healthValue: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },

  // Profile switcher styles
  avatarPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  avatarText: { color: '#FFF', fontWeight: '800', fontSize: 12 },

  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: '#0F112B',
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sheetAvatarLg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginRight: 12,
  },
  avatarLgText: { color: '#FFF', fontWeight: '900', fontSize: 20 },
  sheetGreeting: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  sheetEmail: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  manageBtn: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 8 },
  manageText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 8 },
  accountRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  accountAvatarSm: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', marginRight: 10 },
  avatarSmText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  accountName: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  accountEmail: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  activeMark: { color: '#C7B9FF', fontSize: 16, fontWeight: '900' },
  addAccountRow: { paddingVertical: 12 },
  addAccountText: { color: '#C7B9FF', fontWeight: '800' },
  manageDeviceRow: { paddingVertical: 10 },
  manageDeviceText: { color: 'rgba(255,255,255,0.8)' },
});
