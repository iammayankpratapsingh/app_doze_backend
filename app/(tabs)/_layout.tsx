import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, usePathname, Slot } from 'expo-router';

const { width } = Dimensions.get('window');

const navItems = [
  { id: 'home', label: 'Home', icon: 'home-outline', path: '/(tabs)/home' },
  { id: 'history', label: 'History', icon: 'time-outline', path: '/(tabs)/history' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', path: '/(tabs)/profile' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', path: '/(tabs)/settings' },
];

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <>
      {/* Main content */}
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <Slot />
      </View>

      {/* Floating glossy navbar only */}
      <View style={styles.navWrapper}>
        {/* Frosted glass effect */}
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={[
              'rgba(130, 100, 255, 0.45)', // top violet tint
              'rgba(50, 40, 120, 0.65)',   // mid tone
              'rgba(20, 15, 50, 0.85)',    // bottom fade
            ]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </BlurView>

        {/* Slight diffusion layer */}
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(255,255,255,0.06)',
          }}
        />

        {/* Navbar content */}
        <View style={styles.navContent}>
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.path);
            const color = isActive ? '#C7B9FF' : 'rgba(255,255,255,0.75)';
            const iconName = isActive
              ? (item.icon.replace('-outline', '') as any)
              : (item.icon as any);

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(item.path as any)}
                style={styles.navButton}
                activeOpacity={0.8}
              >
                <Ionicons name={iconName} size={22} color={color} />
                <Text style={[styles.navLabel, { color }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  navWrapper: {
    position: 'absolute',
    bottom: 18,
    left: width * 0.05,
    right: width * 0.05,
    height: 65,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    // 👇 Shadow completely removed
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  navContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navButton: {
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
});
