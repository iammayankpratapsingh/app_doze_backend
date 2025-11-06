import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';

// Global singleton BleManager instance
let bleManagerInstance: BleManager | null = null;
let instanceRefCount = 0;

// Get or create the singleton BleManager instance (exported for use in other contexts)
export function getBleManager(): BleManager {
  if (!bleManagerInstance) {
    console.log('🔵 Creating new BleManager singleton instance');
    bleManagerInstance = new BleManager();
  }
  return bleManagerInstance;
}

// Cleanup the BleManager instance when no longer needed
function cleanupBleManager() {
  if (bleManagerInstance && instanceRefCount === 0) {
    console.log('🔵 Destroying BleManager singleton instance');
    bleManagerInstance.destroy();
    bleManagerInstance = null;
  }
}

// ========== CONFIGURABLE CONSTANTS ==========
const POWER_SAVING_SCAN_DURATION = 300000; // 5 minutes (5 * 60 * 1000)
const POWER_SAVING_SCAN_INTERVAL = 30000; // Scan for 5 seconds
const POWER_SAVING_PAUSE_INTERVAL = 30000; // Pause for 5 seconds

// Generic Access Service (Device Name, Appearance, etc.)
const GENERIC_ACCESS_SERVICE_UUID = '00001800-0000-1000-8000-00805f9b34fb';
const DEVICE_NAME_CHAR_UUID = '00002a00-0000-1000-8000-00805f9b34fb';
const APPEARANCE_CHAR_UUID = '00002a01-0000-1000-8000-00805f9b34fb';

// Device Information Service (Manufacturer, Model, Serial, Firmware, etc.)
const DEVICE_INFO_SERVICE_UUID = '0000180a-0000-1000-8000-00805f9b34fb';
const MANUFACTURER_NAME_CHAR_UUID = '00002a29-0000-1000-8000-00805f9b34fb';
const MODEL_NUMBER_CHAR_UUID = '00002a24-0000-1000-8000-00805f9b34fb';
const SERIAL_NUMBER_CHAR_UUID = '00002a25-0000-1000-8000-00805f9b34fb';
const HARDWARE_REVISION_CHAR_UUID = '00002a27-0000-1000-8000-00805f9b34fb';
const FIRMWARE_REVISION_CHAR_UUID = '00002a26-0000-1000-8000-00805f9b34fb';
const SOFTWARE_REVISION_CHAR_UUID = '00002a28-0000-1000-8000-00805f9b34fb';

interface BluetoothState {
  scannedDevices: Device[];
  connectedDevice: Device | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'disconnecting';
  isScanning: boolean;
  requestPermissions(): Promise<boolean>;
  startScan(): void;
  stopScan(): void;
  connectToDevice(device: Device): Promise<void>;
  disconnectDevice(): Promise<void>;
}

export function useBluetooth(): BluetoothState {
  const [scannedDevices, setScannedDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'disconnecting'>('disconnected');
  const [isScanning, setIsScanning] = useState(false);
  const [deviceConnectionSubscription, setDeviceConnectionSubscription] = useState<Subscription | null>(null);
  
  const scanTimerRef = useRef<any>(null);
  const powerSavingCycleRef = useRef<any>(null);
  const isPowerSavingModeRef = useRef(false);
  const scanStartTimeRef = useRef<number>(0);
  const bleManagerRef = useRef<BleManager>(getBleManager());
  const stateSubscriptionRef = useRef<Subscription | null>(null);

  // Initialize BLE Manager
  useEffect(() => {
    const bleManager = bleManagerRef.current;
    console.log('🔵 Initializing BLE Manager instance...');
    console.log('🔵 bleManager reference:', bleManager ? 'exists' : 'null');
    instanceRefCount++;
    console.log(`🔵 Active BleManager instances: ${instanceRefCount}`);
    
    // Subscribe to state changes
    const subscription = bleManager.onStateChange((state: string) => {
      console.log(`🔵 Bluetooth state changed: ${state}`);
      if (state === 'PoweredOn') {
        console.log('✅ Bluetooth is powered on and ready');
      }
    }, true);
    
    stateSubscriptionRef.current = subscription;
    console.log('🔵 State subscription created');

    return () => {
      console.log('🔵 Cleaning up BLE Manager instance...');
      
      // Stop scanning
      bleManager.stopDeviceScan();
      setIsScanning(false);
      isPowerSavingModeRef.current = false;
      
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
      
      if (powerSavingCycleRef.current) {
        clearTimeout(powerSavingCycleRef.current);
        powerSavingCycleRef.current = null;
      }
      
      // Remove state subscription
      if (subscription) {
        subscription.remove();
      }
      stateSubscriptionRef.current = null;
      
      instanceRefCount--;
      console.log(`🔵 Active BleManager instances: ${instanceRefCount}`);
      
      // Only destroy if this is the last instance
      if (instanceRefCount === 0) {
        cleanupBleManager();
      }
    };
  }, []);

  // Request Bluetooth Permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    console.log('📱 Requesting Bluetooth permissions...');
    
    if (Platform.OS === 'android') {
      const apiLevel = parseInt(Platform.Version.toString(), 10);
      console.log(`📱 Android API Level: ${apiLevel}`);
      
      if (apiLevel < 31) {
        // Android 11 and below
        console.log('📱 Requesting ACCESS_FINE_LOCATION...');
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Bluetooth Low Energy requires location permission to scan for devices.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
        console.log(`📱 Location permission: ${isGranted ? 'GRANTED' : 'DENIED'}`);
        return isGranted;
      } else {
        // Android 12 and above
        console.log('📱 Requesting BLUETOOTH_SCAN and BLUETOOTH_CONNECT...');
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        
        const scanGranted = result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED;
        const connectGranted = result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED;
        
        console.log(`📱 BLUETOOTH_SCAN: ${scanGranted ? 'GRANTED' : 'DENIED'}`);
        console.log(`📱 BLUETOOTH_CONNECT: ${connectGranted ? 'GRANTED' : 'DENIED'}`);
        
        return scanGranted && connectGranted;
      }
    }
    
    // iOS - permissions handled by Info.plist
    console.log('📱 iOS - Bluetooth permissions handled by system');
    return true;
  }, []);

  // Check for duplicate devices
  const isDuplicateDevice = useCallback((devices: Device[], nextDevice: Device) => {
    return devices.findIndex(device => device.id === nextDevice.id) > -1;
  }, []);

  // Stop all scanning activities
  const stopAllScanning = useCallback(() => {
    console.log('🛑 Stopping all scanning activities...');
    
    bleManagerRef.current.stopDeviceScan();
    setIsScanning(false);
    isPowerSavingModeRef.current = false;
    
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    
    if (powerSavingCycleRef.current) {
      clearTimeout(powerSavingCycleRef.current);
      powerSavingCycleRef.current = null;
    }
    
    console.log('✅ All scanning activities stopped');
  }, []);

  // Single cycle of power-saving scan
  const doPowerSavingCycle = useCallback(() => {
    const bleManager = bleManagerRef.current;
    console.log('🔄 doPowerSavingCycle called');
    console.log('🔵 bleManager in doPowerSavingCycle:', bleManager ? 'exists' : 'null');
    
    if (!isPowerSavingModeRef.current) {
      console.log('⚠️ Power-saving mode disabled, stopping cycle');
      return;
    }
    
    // Check if we should still be scanning
    const elapsed = Date.now() - scanStartTimeRef.current;
    if (elapsed >= POWER_SAVING_SCAN_DURATION) {
      console.log(`✅ Power-saving scan completed after ${Math.floor(elapsed / 1000)}s`);
      stopAllScanning();
      return;
    }
    
    const remainingTime = Math.floor((POWER_SAVING_SCAN_DURATION - elapsed) / 1000);
    console.log(`🔄 Power-saving cycle: Scanning for 5s... (${remainingTime}s remaining)`);
    
    setIsScanning(true);
    
    // Start scan with error handling
    try {
      console.log('🔍 Calling bleManager.startDeviceScan...');
      bleManager.startDeviceScan(null, null, (error: any, device: any) => {
        if (error) {
          // Only log critical errors, ignore "scan already in progress"
          if (error.message !== 'Cannot start scanning operation') {
            console.error('❌ Scan Error:', error.message);
          }
          return;
        }
        if (device && device.name) {
          setScannedDevices(prevDevices => {
            if (!isDuplicateDevice(prevDevices, device)) {
              console.log(`📡 Found device: ${device.name} (${device.id})`);
              return [...prevDevices, device];
            }
            return prevDevices;
          });
        }
      });
    } catch (error: any) {
      // Silently handle "scan already in progress" errors
      if (error.message !== 'Cannot start scanning operation') {
        console.error('❌ Failed to start scan:', error.message);
      }
    }
    
    // Stop this scan after SCAN_INTERVAL
    setTimeout(() => {
      if (isPowerSavingModeRef.current) {
        bleManager.stopDeviceScan();
        setIsScanning(false);
        console.log('⏸️ Pausing scan for 5s...');
        
        // Schedule next cycle after PAUSE_INTERVAL
        powerSavingCycleRef.current = setTimeout(() => {
          if (isPowerSavingModeRef.current) {
            doPowerSavingCycle();
          }
        }, POWER_SAVING_PAUSE_INTERVAL);
      }
    }, POWER_SAVING_SCAN_INTERVAL);
  }, [isDuplicateDevice, stopAllScanning]);

  // Start power-saving scan
  const startScan = useCallback(() => {
    console.log('🔍 startScan called');
    console.log('🔵 bleManager in startScan:', bleManagerRef.current ? 'exists' : 'null');
    
    // Stop any existing scans first
    if (isPowerSavingModeRef.current) {
      console.log('⚠️ Scan already in progress, stopping first...');
      stopAllScanning();
    }
    
    console.log('🔍 Starting power-saving scan...');
    console.log(`⏱️ Duration: ${POWER_SAVING_SCAN_DURATION / 1000}s (${POWER_SAVING_SCAN_DURATION / 60000} minutes)`);
    console.log(`⚡ Scan interval: ${POWER_SAVING_SCAN_INTERVAL / 1000}s ON, ${POWER_SAVING_PAUSE_INTERVAL / 1000}s OFF`);
    
    // Clear previous devices
    setScannedDevices([]);
    
    // Start power-saving mode
    isPowerSavingModeRef.current = true;
    scanStartTimeRef.current = Date.now();
    
    console.log('🔍 Calling doPowerSavingCycle...');
    // Start the first scan cycle
    doPowerSavingCycle();
    
    // Set overall timeout
    scanTimerRef.current = setTimeout(() => {
      console.log(`⏰ Scan duration completed (${POWER_SAVING_SCAN_DURATION / 1000}s)`);
      stopAllScanning();
    }, POWER_SAVING_SCAN_DURATION);
  }, [doPowerSavingCycle, stopAllScanning]);

  // Stop scan
  const stopScan = useCallback(() => {
    console.log('🛑 Manually stopping scan...');
    stopAllScanning();
  }, [stopAllScanning]);

  // Read device information characteristics
  const fetchDeviceInfo = useCallback(async (device: Device) => {
    try {
      console.log('\n📋 ========== FETCHING DEVICE INFORMATION ==========');
      console.log(`Device: ${device.name} (${device.id})`);
      
      // Discover all services and characteristics
      console.log('🔍 Discovering services and characteristics...');
      await device.discoverAllServicesAndCharacteristics();
      
      // Get all services
      const services = await device.services();
      console.log(`✅ Found ${services.length} services`);
      
      // Helper function to read characteristic
      const readCharacteristic = async (serviceUUID: string, charUUID: string, name: string): Promise<string | null> => {
        try {
          const char = await device.readCharacteristicForService(serviceUUID, charUUID);
          if (char.value) {
            const decoded = Buffer.from(char.value, 'base64').toString('utf-8');
            console.log(`  ✅ ${name}: ${decoded}`);
            return decoded;
          }
        } catch (error) {
          console.log(`  ⚠️ ${name}: Not available`);
        }
        return null;
      };
      
      // Read Generic Access Service (0x1800)
      console.log('\n📱 Generic Access Service (0x1800):');
      await readCharacteristic(GENERIC_ACCESS_SERVICE_UUID, DEVICE_NAME_CHAR_UUID, 'Device Name');
      await readCharacteristic(GENERIC_ACCESS_SERVICE_UUID, APPEARANCE_CHAR_UUID, 'Appearance');
      
      // Read Device Information Service (0x180A)
      console.log('\n🔧 Device Information Service (0x180A):');
      await readCharacteristic(DEVICE_INFO_SERVICE_UUID, MANUFACTURER_NAME_CHAR_UUID, 'Manufacturer');
      await readCharacteristic(DEVICE_INFO_SERVICE_UUID, MODEL_NUMBER_CHAR_UUID, 'Model Number');
      await readCharacteristic(DEVICE_INFO_SERVICE_UUID, SERIAL_NUMBER_CHAR_UUID, 'Serial Number');
      await readCharacteristic(DEVICE_INFO_SERVICE_UUID, HARDWARE_REVISION_CHAR_UUID, 'Hardware Revision');
      await readCharacteristic(DEVICE_INFO_SERVICE_UUID, FIRMWARE_REVISION_CHAR_UUID, 'Firmware Revision');
      await readCharacteristic(DEVICE_INFO_SERVICE_UUID, SOFTWARE_REVISION_CHAR_UUID, 'Software Revision');
      
      console.log('========================================\n');
    } catch (error) {
      console.error('❌ Error fetching device info:', error);
    }
  }, []);

  // Connect to device
  const connectToDevice = useCallback(async (device: Device) => {
    try {
      const bleManager = bleManagerRef.current;
      console.log(`\n🔗 Connecting to device: ${device.name} (${device.id})...`);
      
      // Stop scanning
      stopAllScanning();
      
      setConnectionStatus('connecting');
      
      // Connect with timeout
      const connectedDevice = await bleManager.connectToDevice(device.id, {
        autoConnect: false,
        timeout: 10000,
      });
      
      console.log(`✅ Connected to ${device.name}`);
      setConnectedDevice(connectedDevice);
      setConnectionStatus('connected');
      
      // Fetch device information
      await fetchDeviceInfo(connectedDevice);
      
      // Setup disconnect listener
      const sub = bleManager.onDeviceDisconnected(device.id, (error: any, disconnectedDevice: any) => {
        if (error) {
          console.error(`❌ Disconnection error for ${disconnectedDevice?.id}:`, error);
        } else {
          console.log(`🔌 Device ${disconnectedDevice?.name} (${disconnectedDevice?.id}) disconnected`);
        }
        
        setConnectedDevice(null);
        setConnectionStatus('disconnected');
        deviceConnectionSubscription?.remove();
      });
      
      setDeviceConnectionSubscription(sub);
      console.log('✅ Disconnect listener registered');

    } catch (error) {
      console.error(`❌ Failed to connect to ${device.id}:`, error);
      setConnectionStatus('disconnected');
      throw error;
    }
  }, [stopAllScanning, fetchDeviceInfo, deviceConnectionSubscription]);

  // Disconnect device
  const disconnectDevice = useCallback(async () => {
    if (!connectedDevice) {
      console.log('⚠️ No device connected');
      return;
    }

    try {
      const bleManager = bleManagerRef.current;
      console.log(`🔌 Disconnecting from ${connectedDevice.name} (${connectedDevice.id})...`);
      
      setConnectionStatus('disconnecting');
      deviceConnectionSubscription?.remove();
      
      await bleManager.cancelDeviceConnection(connectedDevice.id);
      
      console.log(`✅ Disconnected from ${connectedDevice.name}`);
      setConnectedDevice(null);
      setConnectionStatus('disconnected');
    } catch (error) {
      console.error(`❌ Failed to disconnect from ${connectedDevice.id}:`, error);
      // Force update state even if disconnect fails
      setConnectedDevice(null);
      setConnectionStatus('disconnected');
    }
  }, [connectedDevice, deviceConnectionSubscription]);

  return {
    scannedDevices,
    connectedDevice,
    connectionStatus,
    isScanning,
    requestPermissions,
    startScan,
    stopScan,
    connectToDevice,
    disconnectDevice,
  };
}