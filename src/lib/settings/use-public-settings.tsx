import React, { createContext, useContext, useEffect, useState } from "react";
import {
  type HikariPublicSettings,
  DEFAULT_PUBLIC_SETTINGS,
} from "./settings-types";
import { getPublicSettings } from "./settings.functions";

interface PublicSettingsContextValue {
  settings: HikariPublicSettings;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
}

const PublicSettingsContext = createContext<PublicSettingsContextValue>({
  settings: DEFAULT_PUBLIC_SETTINGS,
  isLoading: false,
  refreshSettings: async () => {},
});

export function PublicSettingsProvider({
  initialSettings,
  children,
}: {
  initialSettings?: HikariPublicSettings | null;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<HikariPublicSettings>(
    initialSettings || DEFAULT_PUBLIC_SETTINGS,
  );
  const [isLoading, setIsLoading] = useState(!initialSettings);

  const refreshSettings = async () => {
    try {
      const data = await getPublicSettings();
      if (data) {
        setSettings(data);
      }
    } catch (err) {
      console.warn("[usePublicSettings] Falha ao atualizar public settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialSettings) {
      void refreshSettings();
    }
  }, [initialSettings]);

  return (
    <PublicSettingsContext.Provider
      value={{ settings, isLoading, refreshSettings }}
    >
      {children}
    </PublicSettingsContext.Provider>
  );
}

export function usePublicSettings(): PublicSettingsContextValue {
  return useContext(PublicSettingsContext);
}
