import CustomAlert from '@/components/CustomAlert';
import { useProvisioning } from "@/contexts/ProvisioningContext";
import { getBleManager } from '@/hooks/useBluetooth';
import { Ionicons } from '@expo/vector-icons';
import { Buffer } from "buffer";
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Subscription } from 'react-native-ble-plx';

// Status codes from the device (matching prov_status_t enum)
enum ProvisioningStatus {
  IDLE = 0x00,
  CONNECTING = 0x01,
  SUCCESS = 0x02,
  FAILED = 0x03,
  SSID_NOT_FOUND = 0x04,
}

// Status display configuration
const STATUS_CONFIG = {
  [ProvisioningStatus.IDLE]: {
    text: 'Waiting...',
    icon: 'time-outline' as const,
    color: '#FFA500',
    description: 'Preparing to send credentials'
  },
  [ProvisioningStatus.CONNECTING]: {
    text: 'Connecting to WiFi',
    icon: 'wifi-outline' as const,
    color: '#4A90E2',
    description: 'Device is connecting to your WiFi network'
  },
  [ProvisioningStatus.SUCCESS]: {
    text: 'Connected Successfully',
    icon: 'checkmark-circle' as const,
    color: '#4CAF50',
    description: 'Your device is now connected to WiFi'
  },
  [ProvisioningStatus.FAILED]: {
    text: 'Connection Failed',
    icon: 'close-circle' as const,
    color: '#FF6B6B',
    description: 'Wrong password or connection error'
  },
  [ProvisioningStatus.SSID_NOT_FOUND]: {
    text: 'Network Not Found',
    icon: 'alert-circle' as const,
    color: '#FF6B6B',
    description: 'WiFi network is not available or out of range'
  },
};

export default function ConnectScreen() {
  const { selectedDeviceId, wifiSSID, wifiPassword, sendWifiCredentials } = useProvisioning();
  const router = useRouter();

  const [currentStatus, setCurrentStatus] = useState<ProvisioningStatus>(ProvisioningStatus.IDLE);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', buttons: [] as any[] });
  // Track the last error key reported by device (e.g., wrong_password, ssid_not_found, weak_signal, connect_failed)
  const [lastErrorKey, setLastErrorKey] = useState<string | null>(null);
  
  const statusSubscriptionRef = useRef<Subscription | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // Keep a ref of current status to avoid stale closures in intervals
  const statusRef = useRef<ProvisioningStatus>(ProvisioningStatus.IDLE);

  // Service and characteristic UUIDs (matching Nordic firmware)
  const PROVISION_SERVICE_UUID = "5678DEF0-5678-1234-1234-56789ABC0000";
  const STATUS_CHAR_UUID = "5678DEF2-5678-1234-1234-56789ABC0000";

  // Pulse animation for loading indicator
  useEffect(() => {
    if (currentStatus === ProvisioningStatus.CONNECTING) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [currentStatus]);

  // Fade in animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Keep the status ref updated so polling can read the latest value
  useEffect(() => {
    statusRef.current = currentStatus;
  }, [currentStatus]);

  // Parse status notification from device
  const parseStatusNotification = (base64Data: string) => {
    try {
      const data = Buffer.from(base64Data, 'base64');
      
      console.log('═══════════════════════════════════════');
      console.log('📥 PARSING STATUS NOTIFICATION');
      console.log(`   Length: ${data.length} bytes`);
      console.log(`   Hex: ${data.toString('hex')}`);
      console.log(`   Bytes: ${Array.from(data).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`);
      console.log(`   ASCII: ${data.toString('ascii').replace(/[^\x20-\x7E]/g, '.')}`);
      console.log('═══════════════════════════════════════');
      
      if (data.length === 0) {
        console.warn('⚠️ Empty status notification received');
        return;
      }

      // Check if this is pure JSON (starts with '{')
      const firstByte = data[0];
      if (firstByte === 0x7B) { // '{' character
        console.log('📄 Detected pure JSON format (no status code byte)');
        const jsonString = data.toString('utf-8');
        console.log(`   JSON string: ${jsonString}`);
        
        try {
          const parsed = JSON.parse(jsonString);
          console.log('✅ Parsed JSON:', JSON.stringify(parsed, null, 2));
          setStatusMessage(JSON.stringify(parsed, null, 2));
          
          // Check for error/result in JSON
          if (parsed.error) {
            console.log(`❌ Error detected: ${parsed.error}`);
            if (parsed.error === 'wrong_password' || parsed.error.includes('password')) {
              console.log('   → Setting status to FAILED (wrong password)');
              setCurrentStatus(ProvisioningStatus.FAILED);
              setLastErrorKey('wrong_password');
            } else if (parsed.error === 'ssid_not_found' || parsed.error.includes('ssid')) {
              console.log('   → Setting status to SSID_NOT_FOUND');
              setCurrentStatus(ProvisioningStatus.SSID_NOT_FOUND);
              setLastErrorKey('ssid_not_found');
            } else if (parsed.error === 'weak_signal' || parsed.error.includes('weak')) {
              console.log('   → Setting status to FAILED (weak signal)');
              setCurrentStatus(ProvisioningStatus.FAILED);
              setLastErrorKey('weak_signal');
            } else if (parsed.error === 'connect_failed' || parsed.error.includes('connect')) {
              console.log('   → Setting status to FAILED (connect failed)');
              setCurrentStatus(ProvisioningStatus.FAILED);
              setLastErrorKey('connect_failed');
            } else {
              console.log('   → Setting status to FAILED (generic error)');
              setCurrentStatus(ProvisioningStatus.FAILED);
              setLastErrorKey('connect_failed');
            }
            return;
          } else if (parsed.result === 'success') {
            console.log('✅ Success result detected');
            console.log('   → Setting status to SUCCESS');
            setCurrentStatus(ProvisioningStatus.SUCCESS);
            setLastErrorKey(null);
            return;
          } else if (parsed.status === 'connecting' || parsed.status === 'received' || parsed.status === 'sent') {
            console.log('🔄 Connecting/received/sent status detected');
            console.log('   → Setting status to CONNECTING');
            setCurrentStatus(ProvisioningStatus.CONNECTING);
            setLastErrorKey(null);
            return;
          } else if (parsed.status === 'connected') {
            console.log('✅ Connected status detected');
            console.log('   → Setting status to SUCCESS');
            setCurrentStatus(ProvisioningStatus.SUCCESS);
            setLastErrorKey(null);
            return;
          } else {
            console.log('⚠️ JSON parsed but no recognized status field');
            console.log('   Available fields:', Object.keys(parsed).join(', '));
          }
        } catch (e) {
          console.error('⚠️ JSON parse error:', e);
          setStatusMessage(jsonString);
        }
        return;
      }

      // Original format: first byte is status code
      const statusCode = firstByte;
      console.log(`📊 Status code byte: 0x${statusCode.toString(16).padStart(2, '0')} (${statusCode})`);
      console.log(`   Enum value: ${ProvisioningStatus[statusCode] || 'UNKNOWN'}`);
      
      // Rest is optional JSON message
      let jsonMessage = '';
      if (data.length > 1) {
        jsonMessage = data.slice(1).toString('utf-8');
        console.log(`📄 JSON message (${data.length - 1} bytes): ${jsonMessage}`);
        
        try {
          const parsed = JSON.parse(jsonMessage);
          console.log('✅ Parsed JSON:', JSON.stringify(parsed, null, 2));
          setStatusMessage(JSON.stringify(parsed, null, 2));
          
          // Check for error/result in JSON (overrides status code)
          if (parsed.error) {
            console.log(`❌ Error in JSON overrides status code: ${parsed.error}`);
            if (parsed.error === 'wrong_password' || parsed.error.includes('password')) {
              setCurrentStatus(ProvisioningStatus.FAILED);
              setLastErrorKey('wrong_password');
            } else if (parsed.error === 'ssid_not_found' || parsed.error.includes('ssid')) {
              setCurrentStatus(ProvisioningStatus.SSID_NOT_FOUND);
              setLastErrorKey('ssid_not_found');
            } else if (parsed.error === 'weak_signal' || parsed.error.includes('weak')) {
              setCurrentStatus(ProvisioningStatus.FAILED);
              setLastErrorKey('weak_signal');
            } else if (parsed.error === 'connect_failed' || parsed.error.includes('connect')) {
              setCurrentStatus(ProvisioningStatus.FAILED);
              setLastErrorKey('connect_failed');
            } else {
              setCurrentStatus(ProvisioningStatus.FAILED);
              setLastErrorKey('connect_failed');
            }
            return;
          } else if (parsed.result === 'success') {
            console.log('✅ Success in JSON overrides status code');
            setCurrentStatus(ProvisioningStatus.SUCCESS);
            setLastErrorKey(null);
            return;
          }
        } catch (e) {
          console.log('⚠️ Not valid JSON, treating as plain text');
          setStatusMessage(jsonMessage);
        }
      }

      // Update status from status code byte
      console.log(`🔄 Setting status from code byte: ${statusCode} (${ProvisioningStatus[statusCode]})`);
      setCurrentStatus(statusCode as ProvisioningStatus);
      // Best-effort derive error key when only code is present
      if (statusCode === ProvisioningStatus.SSID_NOT_FOUND) {
        setLastErrorKey('ssid_not_found');
      } else if (statusCode === ProvisioningStatus.FAILED) {
        setLastErrorKey('connect_failed');
      } else if (statusCode === ProvisioningStatus.SUCCESS) {
        setLastErrorKey(null);
      }
      console.log('═══════════════════════════════════════');

    } catch (error) {
      console.error('❌ Error parsing status notification:', error);
      console.error('   Stack:', error);
    }
  };

  // Read status characteristic manually (for testing)
  const readStatusManually = async () => {
    try {
      console.log('📖 Reading status characteristic manually...');
      const bleManager = getBleManager();
      
      const characteristic = await bleManager.readCharacteristicForDevice(
        selectedDeviceId!,
        PROVISION_SERVICE_UUID,
        STATUS_CHAR_UUID
      );
      
      if (characteristic?.value) {
        console.log('📖 Manual read - Status value:', characteristic.value);
        parseStatusNotification(characteristic.value);
      } else {
        console.log('📖 Manual read - No value returned');
      }
    } catch (error) {
      console.error('❌ Error reading status manually:', error);
    }
  };

  // Subscribe to status characteristic notifications
  const subscribeToStatus = async () => {
    try {
      if (!selectedDeviceId) {
        throw new Error('No device selected');
      }

      console.log('═══════════════════════════════════════');
      console.log('🔔 SUBSCRIBING TO STATUS NOTIFICATIONS');
      console.log(`   Device ID: ${selectedDeviceId}`);
      console.log(`   Service UUID: ${PROVISION_SERVICE_UUID}`);
      console.log(`   Status Char UUID: ${STATUS_CHAR_UUID}`);
      console.log('═══════════════════════════════════════');
      
      const bleManager = getBleManager();

      // First, try to read the current status
      console.log('📖 Reading initial status value...');
      try {
        const initialChar = await bleManager.readCharacteristicForDevice(
          selectedDeviceId,
          PROVISION_SERVICE_UUID,
          STATUS_CHAR_UUID
        );
        
        if (initialChar?.value) {
          console.log('📖 Initial status value:', initialChar.value);
          parseStatusNotification(initialChar.value);
        } else {
          console.log('📖 No initial status value');
        }
      } catch (readError) {
        console.error('⚠️ Could not read initial status:', readError);
      }

      // Monitor the status characteristic for updates
      console.log('🔔 Starting to monitor for notifications...');
      const subscription = bleManager.monitorCharacteristicForDevice(
        selectedDeviceId,
        PROVISION_SERVICE_UUID,
        STATUS_CHAR_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('❌ Status monitoring error:', error);
            console.error('   Error code:', error.errorCode);
            console.error('   Error message:', error.message);
            return;
          }

          if (characteristic?.value) {
            console.log('═══════════════════════════════════════');
            console.log('📨 STATUS NOTIFICATION RECEIVED');
            console.log(`   Timestamp: ${new Date().toISOString()}`);
            console.log(`   Characteristic UUID: ${characteristic.uuid}`);
            console.log(`   Value (base64): ${characteristic.value}`);
            console.log('═══════════════════════════════════════');
            parseStatusNotification(characteristic.value);
          } else {
            console.log('⚠️ Notification received but no value');
          }
        }
      );

      statusSubscriptionRef.current = subscription;
      console.log('✅ Status subscription active');
      
      // Poll status every 2 seconds as a fallback
      console.log('⏱️ Starting status polling (every 2s)...');
      const pollInterval = setInterval(() => {
        const s = statusRef.current;
        if (s === ProvisioningStatus.SUCCESS || 
            s === ProvisioningStatus.FAILED || 
            s === ProvisioningStatus.SSID_NOT_FOUND) {
          console.log('⏹️ Stopping status polling (final state reached)');
          clearInterval(pollInterval);
          return;
        }
        
        console.log('🔄 Polling status...');
        readStatusManually();
      }, 2000);
      
      // Store interval for cleanup
      (statusSubscriptionRef.current as any).pollInterval = pollInterval;

    } catch (error) {
      console.error('❌ Error subscribing to status:', error);
      console.error('   Full error:', JSON.stringify(error, null, 2));
    }
  };

  // Send credentials and monitor progress
  const initiateProvisioning = async () => {
    try {
      console.log('═══════════════════════════════════════');
      console.log('🚀 STARTING WIFI PROVISIONING');
      console.log(`   SSID: ${wifiSSID}`);
      console.log(`   Password: ${wifiPassword ? '***' + wifiPassword.slice(-4) : 'empty'}`);
      console.log(`   Device: ${selectedDeviceId}`);
      console.log('═══════════════════════════════════════');

      // Subscribe to status updates first
      console.log('📡 Step 1: Subscribe to status notifications');
      await subscribeToStatus();

      // Small delay to ensure subscription is ready
      console.log('⏳ Waiting 1 second for subscription to stabilize...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send credentials
      console.log('═══════════════════════════════════════');
      console.log('📤 Step 2: Sending WiFi credentials to device');
      console.log('═══════════════════════════════════════');
      const success = await sendWifiCredentials();

      if (!success) {
        throw new Error('Failed to send WiFi credentials');
      }

      console.log('✅ Credentials sent successfully!');
      console.log('⏳ Waiting for device response...');
      console.log('   Expected status updates:');
      console.log('   1. CONNECTING (0x01)');
      console.log('   2. SUCCESS (0x02) or FAILED (0x03/0x04)');
      console.log('═══════════════════════════════════════');
      
      // The status will be updated via notifications or polling
      // After 45 seconds, if no final status, show timeout
      setTimeout(() => {
        if (currentStatus !== ProvisioningStatus.SUCCESS && 
            currentStatus !== ProvisioningStatus.FAILED &&
            currentStatus !== ProvisioningStatus.SSID_NOT_FOUND) {
          console.log('⏱️ Provisioning timeout - no final status received');
          console.log(`   Current status: ${currentStatus} (${ProvisioningStatus[currentStatus]})`);
          setAlertConfig({
            title: 'Connection Timeout',
            message: 'The device did not respond in time. Please check:\n\n• Device is powered on\n• WiFi credentials are correct\n• Network is available',
            buttons: [
              {
                text: 'Retry',
                onPress: () => {
                  setShowAlert(false);
                  setCurrentStatus(ProvisioningStatus.IDLE);
                  setIsProcessing(true);
                  setTimeout(() => initiateProvisioning(), 500);
                }
              },
              {
                text: 'Cancel',
                onPress: () => {
                  setShowAlert(false);
                  router.back();
                }
              }
            ]
          });
          setShowAlert(true);
        }
      }, 45000);

    } catch (error) {
      console.error('❌ Provisioning error:', error);
      setCurrentStatus(ProvisioningStatus.FAILED);
      setStatusMessage('Failed to send credentials');
      setIsProcessing(false);
    }
  };

  // Cleanup BLE connection
  const cleanupBleConnection = async () => {
    try {
      console.log('🧹 Cleaning up BLE connection...');
      
      // Clear polling interval
      if (statusSubscriptionRef.current && (statusSubscriptionRef.current as any).pollInterval) {
        console.log('⏹️ Clearing status poll interval');
        clearInterval((statusSubscriptionRef.current as any).pollInterval);
      }
      
      // Remove subscription
      if (statusSubscriptionRef.current) {
        console.log('🔕 Removing status subscription');
        statusSubscriptionRef.current.remove();
        statusSubscriptionRef.current = null;
      }

      if (selectedDeviceId) {
        const bleManager = getBleManager();
        
        // Check if device is still connected
        const isConnected = await bleManager.isDeviceConnected(selectedDeviceId);
        
        if (isConnected) {
          console.log('🔌 Disconnecting from device...');
          await bleManager.cancelDeviceConnection(selectedDeviceId);
          console.log('✅ Device disconnected');
        } else {
          console.log('ℹ️ Device already disconnected');
        }
      }
      
      console.log('✅ BLE cleanup complete');
    } catch (error) {
      console.error('❌ Error during BLE cleanup:', error);
    }
  };

  // Handle status changes
  useEffect(() => {
    if (currentStatus === ProvisioningStatus.SUCCESS) {
      console.log('✅ SUCCESS status received - stopping processing');
      setIsProcessing(false);
      // Don't auto-navigate, wait for user to click Continue
    } else if (currentStatus === ProvisioningStatus.FAILED || currentStatus === ProvisioningStatus.SSID_NOT_FOUND) {
      console.log('❌ FAILED status received - stopping processing');
      setIsProcessing(false);
    } else if (currentStatus === ProvisioningStatus.CONNECTING) {
      console.log('🔄 CONNECTING status - keep processing');
      setIsProcessing(true);
    }
  }, [currentStatus]);

  // Start provisioning on mount
  useEffect(() => {
    if (!selectedDeviceId) {
      console.error('No device selected, going back');
      router.back();
      return;
    }

    initiateProvisioning();

    // Cleanup on unmount
    return () => {
      console.log('🧹 Component unmounting - cleaning up');
      cleanupBleConnection();
    };
  }, []);

  const config = STATUS_CONFIG[currentStatus];
  const isError = currentStatus === ProvisioningStatus.FAILED || currentStatus === ProvisioningStatus.SSID_NOT_FOUND;
  const isSuccess = currentStatus === ProvisioningStatus.SUCCESS;

  const handleRetry = async () => {
    console.log('🔄 Retry button pressed - cleaning up and going back to scan');
    
    // Cleanup current BLE connection
    await cleanupBleConnection();
    
    // Navigate back to scan screen to start fresh
    router.push('/(bluetooth)/ScanScreen');
  };

  const handleContinue = async () => {
    console.log('✅ Continue button pressed - cleaning up and navigating to complete screen');
    
    // Cleanup BLE connection
    await cleanupBleConnection();
    
    // Navigate to completion screen
    router.push('/(bluetooth)/ProvisionCompleteScreen');
  };

  const handleCancel = async () => {
    console.log('❌ Cancel button pressed - cleaning up');
    
    // Cleanup BLE connection
    await cleanupBleConnection();
    
    // Go back
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#1D244D', '#02041A', '#1A1D3E']} style={styles.gradientBackground} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerIconContainer}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Setting Up Dozemate</Text>
        <View style={styles.headerIconContainer} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Status Icon */}
        <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[styles.iconCircle, { backgroundColor: config.color + '20' }]}>
            <Ionicons name={config.icon} size={80} color={config.color} />
          </View>
        </Animated.View>

        {/* Network Name */}
        <View style={styles.networkInfo}>
          <Ionicons name="wifi" size={20} color="rgba(255, 255, 255, 0.6)" />
          <Text style={styles.networkName}>{wifiSSID}</Text>
        </View>

        {/* Status Text */}
        <Text style={[styles.statusText, { color: config.color }]}>{config.text}</Text>
        {/* Dynamic description: override with friendly error messages when available */}
        <Text style={styles.statusDescription}>{(() => {
          if (currentStatus === ProvisioningStatus.SSID_NOT_FOUND) {
            return 'WiFi network is not available or out of range';
          }
          if (currentStatus === ProvisioningStatus.FAILED) {
            switch (lastErrorKey) {
              case 'wrong_password':
                return 'Wrong WiFi password. Please double-check and try again.';
              case 'weak_signal':
                return 'Signal is too weak. Move the device closer to the router and retry.';
              case 'connect_failed':
                return 'Could not connect to the network. Check router/internet and try again.';
              default:
                return STATUS_CONFIG[ProvisioningStatus.FAILED].description;
            }
          }
          return config.description;
        })()}</Text>

        {/* Progress Indicator - Show while IDLE or CONNECTING */}
        {(currentStatus === ProvisioningStatus.IDLE || currentStatus === ProvisioningStatus.CONNECTING) && (
          <ActivityIndicator size="large" color={config.color} style={styles.loader} />
        )}

        {/* Status Message */}
        {statusMessage !== '' && (
          <View style={styles.messageContainer}>
            <Text style={styles.messageLabel}>Device Response:</Text>
            <Text style={styles.messageText}>{statusMessage}</Text>
          </View>
        )}

        {/* Action Buttons for Error States */}
        {isError && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={handleRetry} style={[styles.button, styles.retryButton]}>
              <Ionicons name="refresh" size={20} color="#FFF" />
              <Text style={styles.buttonText}>Retry Setup</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCancel} style={[styles.button, styles.cancelButton]}>
              <Ionicons name="close" size={20} color="#FFF" />
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Button for Success State */}
        {isSuccess && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={handleContinue} style={[styles.button, styles.successButton]}>
              <Ionicons name="checkmark" size={20} color="#FFF" />
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Custom Alert */}
      <CustomAlert
        visible={showAlert}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setShowAlert(false)}
      />
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: Platform.OS === 'android' ? 50 : 0,
    paddingBottom: 10,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    marginBottom: 30,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
  },
  networkName: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  statusText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  statusDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 20,
  },
  loader: {
    marginVertical: 20,
  },
  messageContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 15,
    marginTop: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  messageText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 30,
    gap: 15,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    gap: 8,
  },
  retryButton: {
    backgroundColor: '#4A90E2',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  successButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successNote: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    marginTop: 20,
    fontStyle: 'italic',
  },
});
