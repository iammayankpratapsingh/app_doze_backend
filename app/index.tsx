//import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';


const { width } = Dimensions.get('window');

WebBrowser.maybeCompleteAuthSession();

export default function Index() {

  const router = useRouter();
  const { auth } = useAuth();
  const [onboardingChecked, setOnboardingChecked] = useState<boolean>(false);
  const [onboardingSeen, setOnboardingSeen] = useState<boolean>(false);
  const [setupChecked, setSetupChecked] = useState<boolean>(false);
  const [setupSeen, setSetupSeen] = useState<boolean>(false);

  
  // Animations
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const logoFloatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    
    

    // Initial fade-in for all content
    Animated.timing(contentFadeAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start();

    // Gentle floating animation for the logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloatAnim, {
          toValue: 10,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(logoFloatAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Redirect after checks
  useEffect(() => {
    (async () => {
      if (!onboardingChecked || !setupChecked) return;
      if (!auth.isLoading) {
        if (!onboardingSeen) {
          router.replace('/onboarding');
        } else if (auth.isLoggedIn) {
          if (!setupSeen) {
            try { await AsyncStorage.setItem('setup_seen_v1', '1'); } catch {}
            router.replace('/setup');
          } else {
            router.replace('/(tabs)/home');
          }
        }
      }
    })();
  }, [auth.isLoading, auth.isLoggedIn, onboardingChecked, onboardingSeen, setupChecked, setupSeen]);

  // Check onboarding flag once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const v = await AsyncStorage.getItem('onboarding_seen_v1');
        if (!mounted) return;
        setOnboardingSeen(!!v);
        setOnboardingChecked(true);
      } catch {
        if (!mounted) return;
        setOnboardingSeen(false);
        setOnboardingChecked(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Check setup flag once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const v = await AsyncStorage.getItem('setup_seen_v1');
        if (!mounted) return;
        setSetupSeen(!!v);
        setSetupChecked(true);
      } catch {
        if (!mounted) return;
        setSetupSeen(false);
        setSetupChecked(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Handlers
  const handleSignUp = () => router.push('/(authentication)/signup1');
  const handleSignIn = () => router.push('/(authentication)/signin');
  const handleGoogleLogin = () => {
    // TODO: Implement Google Login
    console.log("Google Login Pressed");
  };
  // const handleAppleLogin = () => {
  //   // TODO: Implement Apple Login
  //   console.log("Apple Login Pressed");
  // };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1D244D', '#02041A', '#1A1D3E']}
        style={styles.gradientBackground}
      />

      {/* Main content with fade-in animation */}
      <Animated.View style={[styles.content, { opacity: contentFadeAnim }]}>
        
        {/* Logo Section */}
        <Animated.View style={{ transform: [{ translateY: logoFloatAnim }] }}>
          <Image
            source={require("../assets/images/dozemate_transparent.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Text Section */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Dozemate</Text>
          <Text style={styles.tagline}>"bio-sense for smart beds"</Text>
        </View>

        

        {/* Glass UI Actions Section */}
        <BlurView intensity={25} tint="dark" style={styles.actionsContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleSignUp}>
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          {/* Social Login Buttons */}
          <View style={styles.socialLoginContainer}>
            <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin}>
              <Image 
                source={require("../assets/images/icons8-google-96.png")} 
                style={styles.googleIcon}
                resizeMode="contain"
              />
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity>
            {/* Apple login commented out for now */}
            {/* {Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.socialButton} onPress={handleAppleLogin}>
                <Ionicons name="logo-apple" size={24} color="black" />
                <Text style={[styles.socialButtonText, { color: 'black' }]}>Login with Apple</Text>
              </TouchableOpacity>
            )} */}
          </View>

          <TouchableOpacity onPress={handleSignIn}>
            <Text style={styles.signInText}>Already have an account? <Text style={{fontWeight: 'bold'}}>Log In</Text></Text>
          </TouchableOpacity>
          
        </BlurView>

        {/* <TouchableOpacity style={styles.testBluetoothContainer} onPress={() => router.push('/(bluetooth)/BluetoothScan')}>
            <Text style={styles.tagline}>Test Bluetooth</Text>
        </TouchableOpacity> */}

        <TouchableOpacity style={styles.testBluetoothContainer} onPress={() => router.push('/(wifi)/provision')}>
            <Text style={styles.tagline}>Test Provisioning</Text>
        </TouchableOpacity>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#02041A',
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '100%',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  logo: {
    width: width * 1.1,
    height: width * 1.1,
    marginTop: '20%',
    marginBottom: '-20%',

  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 'auto',
    marginTop: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 'black',
    fontStyle: 'normal',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 12,
    fontStyle: 'italic',
  },
  actionsContainer: {
    width: '100%',
    padding: 20,
    borderRadius: 30,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#1D244D',
    fontSize: 16,
    fontWeight: 'bold',
  },
  socialLoginContainer: {
    width: '100%',
    gap: 15,
    marginBottom: 20,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 20,
    gap: 10,
  },
  socialButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  googleIcon: {
    width: 22,
    height: 22,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dividerText: {
    color: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 10,
  },
  signInText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  testBluetoothContainer: {
        paddingTop: 15,
  },
});