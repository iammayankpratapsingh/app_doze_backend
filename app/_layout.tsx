import { AuthProvider } from "@/contexts/AuthContext";
import { ProvisioningProvider } from "@/contexts/ProvisioningContext";
import { SignupProvider } from "@/contexts/SignupContext";
import { Stack } from "expo-router";
import { BluetoothProvider } from '../contexts/BluetoothProvider';
import AnimatedSplash from '@/components/AnimatedSplash';
import { GestureHandlerRootView } from 'react-native-gesture-handler';


export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SignupProvider>
        <BluetoothProvider>
        <ProvisioningProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#02041A" },
              animation: "fade_from_bottom", // Use a simple fade for clean transitions
              animationDuration: 3000, // A faster duration feels more responsive
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(authentication)" />
            <Stack.Screen name="(bluetooth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="setup" />
            <Stack.Screen name="onboarding" />
          </Stack>
          {/* Global animated splash overlay */}
          <AnimatedSplash />
        </ProvisioningProvider>
      </BluetoothProvider>
      </SignupProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}