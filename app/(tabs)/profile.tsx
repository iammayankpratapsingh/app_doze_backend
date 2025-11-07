import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

function FieldRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} style={styles.fieldRow} activeOpacity={onPress ? 0.8 : 1}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.valueWrapper}>
        <Text style={styles.fieldValue}>{value}</Text>
        {onPress ? <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.7)" /> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { auth, fetchProfile, saveLocalProfile } = useAuth();

  const initial = useMemo(() => {
    const p: any = auth.user?.profile || {};
    const name: string = auth.user?.name || p.name || '';
    const parts = name.split(' ');
    const firstName = p.firstName || parts[0] || '';
    const lastName = p.lastName || parts.slice(1).join(' ') || '';
    return {
      firstName,
      lastName,
      dateOfBirth: p.dateOfBirth || p.dob || '',
      gender: (p.gender || 'Male') as string,
      waist: String(p.waist ?? '35'),
      waistUnit: String(p.waistUnit ?? 'in'),
      weight: String(p.weight ?? '81'),
      weightUnit: String(p.weightUnit ?? 'kg'),
      height: String(p.height ?? "6'0\"") ,
      heightUnit: String(p.heightUnit ?? 'ft_in'),
      stepsGoal: Number(p.stepsGoal ?? 9500),
    };
  }, [auth.user]);

  const [stepsGoal, setStepsGoal] = useState<number>(initial.stepsGoal);
  const [gender, setGender] = useState<string>(initial.gender);
  const [waist, setWaist] = useState<string>(initial.waist);
  const [weight, setWeight] = useState<string>(initial.weight);
  const [height, setHeight] = useState<string>(initial.height);
  const [genderOpen, setGenderOpen] = useState<boolean>(false);

  useEffect(() => {
    // Refresh profile from server if we don't have one
    if (!auth.user?.profile) {
      fetchProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cycle = (value: string, options: string[]) => {
    const idx = options.indexOf(value);
    return options[(idx + 1) % options.length];
  };

  const onUpdate = async () => {
    const nextProfile = {
      ...auth.user?.profile,
      firstName: initial.firstName,
      lastName: initial.lastName,
      dateOfBirth: initial.dateOfBirth,
      gender,
      waist,
      waistUnit: 'in',
      weight,
      weightUnit: 'kg',
      height,
      heightUnit: 'ft_in',
      stepsGoal,
    };
    await saveLocalProfile(nextProfile);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#02041A" />
      <LinearGradient colors={['#1D244D', '#02041A', '#1A1D3E']} style={styles.gradientBackground} />

      {/* Header (match History style) */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}> 
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerActions}>
            <TouchableOpacity style={styles.connectNow} onPress={() => (require('expo-router').router.push('/setup'))}>
              <Text style={styles.connectText}>Connect Now</Text>
            </TouchableOpacity>
            <Ionicons name="settings-outline" size={24} color="#fff" style={{ marginLeft: 14 }} />
            <TouchableOpacity onPress={() => (require('expo-router').router.push('/(tabs)/user-info'))}>
              <Ionicons name="person-circle-outline" size={30} color="#fff" style={{ marginLeft: 12 }} />
            </TouchableOpacity>
          </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>

        {/* Identity compact card */}
        <BlurView intensity={25} tint="dark" style={styles.identityCard}>
          <Ionicons name="person-circle-outline" size={36} color="#C7B9FF" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.identityName}>{[initial.firstName, initial.lastName].filter(Boolean).join(' ') || '—'}</Text>
            {auth.user?.email ? <Text style={styles.identitySub}>{auth.user.email}</Text> : null}
          </View>
        </BlurView>

        <BlurView intensity={25} tint="dark" style={styles.card}>
          <Text style={styles.cardTitle}>Steps goals</Text>
          <View style={styles.stepRow}>
            <TouchableOpacity onPress={() => setStepsGoal(g => Math.max(0, g - 100))} style={styles.iconBtn}>
              <Ionicons name="remove" size={18} color="#02041A" />
            </TouchableOpacity>
            <Text style={styles.stepsValue}>{stepsGoal}</Text>
            <TouchableOpacity onPress={() => setStepsGoal(g => Math.min(50000, g + 100))} style={styles.iconBtn}>
              <Ionicons name="add" size={18} color="#02041A" />
            </TouchableOpacity>
          </View>
        </BlurView>

        <View style={styles.gridRow}>
          <BlurView intensity={25} tint="dark" style={[styles.card, styles.gridItem, styles.genderCard]}>
            <TouchableOpacity onPress={() => setGenderOpen(o => !o)} activeOpacity={0.8}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Gender</Text>
                <View style={styles.valueWrapper}>
                  <Text style={styles.fieldValue}>{gender}</Text>
                  <Ionicons name={genderOpen ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.7)" />
                </View>
              </View>
            </TouchableOpacity>
            {genderOpen && (
              <View style={styles.dropdown}>
                {['Male', 'Female', 'Other'].map(opt => (
                  <TouchableOpacity key={opt} style={styles.dropdownItem} onPress={() => { setGender(opt); setGenderOpen(false); }}>
                    <Text style={styles.dropdownText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </BlurView>
          <BlurView intensity={25} tint="dark" style={[styles.card, styles.gridItem]}>
            <FieldRow
              label="Waist"
              value={`${waist} in`}
              onPress={() => setWaist(v => String(Number(v) >= 44 ? 28 : Number(v || '28') + 1))}
            />
          </BlurView>
        </View>

        <View style={styles.gridRow}>
          <BlurView intensity={25} tint="dark" style={[styles.card, styles.gridItem]}>
            <FieldRow
              label="Weight"
              value={`${weight} kg`}
              onPress={() => setWeight(v => String(Number(v) >= 200 ? 40 : Number(v || '40') + 1))}
            />
          </BlurView>
          <BlurView intensity={25} tint="dark" style={[styles.card, styles.gridItem]}>
            <FieldRow
              label="Height"
              value={height}
              onPress={() => setHeight(h => (h === "6'0\"" ? "5'10\"" : "6'0\""))}
            />
          </BlurView>
        </View>

        <TouchableOpacity style={styles.updateBtn} onPress={onUpdate}>
          <Text style={styles.updateText}>Update</Text>
        </TouchableOpacity>
        <View style={{ height: 90 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02041A' },
  gradientBackground: { position: 'absolute', width: '100%', height: '100%' },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  header: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  connectNow: { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  connectText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  identityCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 12 },
  identityName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  identitySub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  card: { borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 12 },
  cardTitle: { color: '#C7B9FF', fontWeight: '700', marginBottom: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { backgroundColor: '#C7B9FF', width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stepsValue: { color: '#fff', fontSize: 18, fontWeight: '800', marginHorizontal: 16 },

  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  fieldLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  valueWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldValue: { color: '#fff', fontSize: 14, fontWeight: '700' },
  dropdown: { position: 'absolute', left: 10, right: 10, top: 44, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', zIndex: 100, elevation: 6 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 10 },
  dropdownText: { color: '#fff', fontSize: 14 },

  gridRow: { flexDirection: 'row', gap: 12, overflow: 'visible' },
  gridItem: { flex: 1 },
  genderCard: { position: 'relative' },

  updateBtn: { marginTop: 8, backgroundColor: '#7B66FF', paddingVertical: 14, borderRadius: 18, alignItems: 'center' },
  updateText: { color: '#fff', fontWeight: '800' },
});

