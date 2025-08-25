"use client";

import { useState, useEffect, useCallback } from "react";

// Define the shape of our settings object
interface AppSettings {
  lowStockThreshold: number;
  defaultToPrintBill: boolean;
}

// Define the default values
const defaultSettings: AppSettings = {
  lowStockThreshold: 5,
  defaultToPrintBill: false,
};

export function useAppSettings() {
  // Initialize state with default values, will be updated from localStorage
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  // On initial load, try to get settings from localStorage
  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem("appSettings");
      if (storedSettings) {
        setSettings(JSON.parse(storedSettings));
      }
    } catch (error) {
      console.error("Failed to parse settings from localStorage", error);
    }
  }, []);

  // Function to update and save settings
  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prevSettings) => {
      const updated = { ...prevSettings, ...newSettings };
      try {
        localStorage.setItem("appSettings", JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save settings to localStorage", error);
      }
      return updated;
    });
  }, []);

  return { settings, updateSettings };
}
