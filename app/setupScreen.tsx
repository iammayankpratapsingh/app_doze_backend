import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  Linking,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function SetupScreen() {
  const router = useRouter();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handleSetupDozemate = () => {
    router.push('/(bluetooth)/BluetoothScan');
  };

  const handleBuyDozemate = () => {
    Linking.openURL('https://www.slimiot.com/');
  };

  const startZoomAnimation = React.useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 2000,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim]);

  React.useEffect(() => {
    startZoomAnimation();
    const interval = setInterval(startZoomAnimation, 4000);
    return () => clearInterval(interval);
  }, [startZoomAnimation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#02041A" />

      <LinearGradient
        colors={['#1D244D', '#02041A', '#1A1D3E']}
        style={styles.gradientBackground}
      />

      <TouchableOpacity
        style={styles.skipButton}
        onPress={() => router.replace('/(tabs)/home')}
        activeOpacity={0.8}
      >
        <Text style={styles.skipButtonText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.contentContainer}>
        <Text style={styles.title}>Connect your Dozemate</Text>

        <View style={styles.deviceContainer}>
          <Animated.Image
            source={require('../assets/images/dozemate_transparent.png')}
            style={[styles.deviceImage, { transform: [{ scale: scaleAnim }] }]}
            resizeMode="contain"
          />
        </View>

        <BlurView intensity={25} tint="dark" style={styles.glassContainer}>
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.setupButton}
              onPress={handleSetupDozemate}
              activeOpacity={0.8}
            >
              <Text style={styles.setupButtonText}>Setup Dozemate</Text>
            </TouchableOpacity>

            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            <TouchableOpacity
              style={styles.buyButton}
              onPress={handleBuyDozemate}
              activeOpacity={0.8}
            >
              <Text style={styles.buyButtonText}>Buy Dozemate</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#02041A',
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  deviceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  deviceImage: {
    width: width * 1.3,
    height: width * 1.2,
  },
  glassContainer: {
    width: '100%',
    padding: 20,
    borderRadius: 30,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonsContainer: {
    width: '100%',
    gap: 0,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  orText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '500',
    marginHorizontal: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  setupButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  setupButtonText: {
    color: '#1D244D',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buyButton: {
    backgroundColor: 'transparent',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    position: 'absolute',
    top: (StatusBar.currentHeight || 0) + (Platform.OS === 'ios' ? 50 : 10),
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    zIndex: 10,
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});


