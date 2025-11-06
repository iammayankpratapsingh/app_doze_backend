import { getBleManager } from "@/hooks/useBluetooth";
import { Buffer } from "buffer";
import React, { createContext, ReactNode, useContext, useState } from "react";
import { Device } from "react-native-ble-plx";

interface ProvisioningContextType {
  wifiSSID: string;
  wifiPassword: string;
  selectedDevice: Device | null;
  selectedDeviceId: string | null;
  setWifiSSID: (ssid: string) => void;
  setWifiPassword: (password: string) => void;
  setSelectedDevice: (device: Device | null) => void;
  sendWifiCredentials: () => Promise<boolean>;
}

const ProvisioningContext = createContext<ProvisioningContextType | undefined>(undefined);

export const ProvisioningProvider = ({ children }: { children: ReactNode }) => {
  const [wifiSSID, setWifiSSID] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // UUIDs matching your Nordic firmware (nRF52832)
  // Service UUID: 5678DEF0 (short) = 5678DEF0-5678-1234-1234-56789ABC0000 (full)
  // Credentials characteristic: 5678DEF1 (short) = 5678DEF1-5678-1234-1234-56789ABC0000 (full)
  // Status characteristic: 5678DEF2 (short) = 5678DEF2-5678-1234-1234-56789ABC0000 (full)
  const PROVISION_SERVICE_UUID = "5678DEF0-5678-1234-1234-56789ABC0000";
  const WIFI_CHAR_UUID = "5678DEF1-5678-1234-1234-56789ABC0000";  // Changed from DEF0...0001 to DEF1...0000
  const STATUS_CHAR_UUID = "5678DEF2-5678-1234-1234-56789ABC0000";  // For future use

  const handleSetSelectedDevice = (device: Device | null) => {
    setSelectedDevice(device);
    setSelectedDeviceId(device?.id || null);
  };

  const sendWifiCredentials = async (): Promise<boolean> => {
    try {
      if (!selectedDeviceId) {
        throw new Error("No device selected");
      }

      console.log(`Sending WiFi credentials to device: ${selectedDeviceId}`);
      
      // Get the singleton BleManager instance
      const bleManager = getBleManager();
      
      // Step 1: Check if device is connected
      console.log("Checking device connection status...");
      const isConnected = await bleManager.isDeviceConnected(selectedDeviceId);
      
      if (!isConnected) {
        console.log("Device not connected, attempting to reconnect...");
        await bleManager.connectToDevice(selectedDeviceId, { timeout: 10000 });
        console.log("Device reconnected successfully");
      } else {
        console.log("Device is already connected");
      }

      // Step 2: Discover all services and characteristics
      console.log("Discovering services and characteristics...");
      const device = await bleManager.discoverAllServicesAndCharacteristicsForDevice(selectedDeviceId);
      console.log("Service discovery completed");

      // Step 3: Verify the service exists
      console.log(`Checking for service ${PROVISION_SERVICE_UUID}...`);
      const services = await device.services();
      const provisionService = services.find(s => s.uuid.toUpperCase() === PROVISION_SERVICE_UUID.toUpperCase());
      
      if (!provisionService) {
        console.error("Available services:", services.map(s => s.uuid));
        throw new Error(`Provisioning service ${PROVISION_SERVICE_UUID} not found on device`);
      }
      console.log("Provisioning service found!");

      // Step 4: Verify the characteristic exists
      console.log(`Checking for characteristic ${WIFI_CHAR_UUID}...`);
      const characteristics = await provisionService.characteristics();
      const wifiChar = characteristics.find(c => c.uuid.toUpperCase() === WIFI_CHAR_UUID.toUpperCase());
      
      if (!wifiChar) {
        console.error("Available characteristics:", characteristics.map(c => c.uuid));
        throw new Error(`WiFi credential characteristic ${WIFI_CHAR_UUID} not found`);
      }
      console.log("WiFi credential characteristic found!");

      // Step 5: Build the JSON payload matching the firmware format
      const creds = JSON.stringify({
        ssid: wifiSSID,
        password: wifiPassword,
      });

      console.log(`WiFi credentials payload: ${creds}`);

      // Step 6: Convert to base64 as expected by BLE
      const base64Creds = Buffer.from(creds).toString("base64");
      
      console.log(`Writing ${base64Creds.length} bytes to characteristic...`);

      // Step 7: Write the credentials
      await bleManager.writeCharacteristicWithResponseForDevice(
        selectedDeviceId,
        PROVISION_SERVICE_UUID,
        WIFI_CHAR_UUID,
        base64Creds
      );

      console.log("WiFi credentials sent successfully!");
      return true;
    } catch (err: any) {
      console.error("Error sending credentials:", err);
      console.error("Error details:", {
        message: err.message,
        errorCode: err.errorCode,
        iosErrorCode: err.iosErrorCode,
        androidErrorCode: err.androidErrorCode,
        reason: err.reason,
        deviceId: selectedDeviceId,
        serviceUUID: PROVISION_SERVICE_UUID,
        charUUID: WIFI_CHAR_UUID,
      });
      return false;
    }
  };

  return (
    <ProvisioningContext.Provider
      value={{
        wifiSSID,
        wifiPassword,
        selectedDevice,
        selectedDeviceId,
        setWifiSSID,
        setWifiPassword,
        setSelectedDevice: handleSetSelectedDevice,
        sendWifiCredentials,
      }}
    >
      {children}
    </ProvisioningContext.Provider>
  );
};

export const useProvisioning = () => {
  const context = useContext(ProvisioningContext);
  if (!context)
    throw new Error("useProvisioning must be used within ProvisioningProvider");
  return context;
};
