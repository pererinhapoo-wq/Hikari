import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type HikariAdminSettings,
  type HikariPublicSettings,
  DEFAULT_PUBLIC_SETTINGS,
  toPublicSettings,
} from "./settings-types";
import { getPublicSettings } from "./settings.functions";

interface PublicSettingsContextValue {
  settings: HikariPublicSettings;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
  applyAdminSettings: (adminSettings: HikariAdminSettings) => void;
}

const PublicSettingsContext = createContext<PublicSettingsContextValue>({
  settings: DEFAULT_PUBLIC_SETTINGS,
  isLoading: false,
  refreshSettings: async () => {},
  applyAdminSettings: () => {},
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

  const refreshSettings = useCallback(async () => {
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
  }, []);

  const applyAdminSettings = useCallback(
    (adminSettings: HikariAdminSettings) => {
      setSettings(toPublicSettings(adminSettings));
      setIsLoading(false);
    },
    [],
  );

  useEffect(() => {
    if (!initialSettings) {
      void refreshSettings();
    }
  }, [initialSettings, refreshSettings]);

  const value = useMemo(
    () => ({
      settings,
      isLoading,
      refreshSettings,
      applyAdminSettings,
    }),
    [settings, isLoading, refreshSettings, applyAdminSettings],
  );

  return (
    <PublicSettingsContext.Provider value={value}>
      {children}
    </PublicSettingsContext.Provider>
  );
}

export function usePublicSettings(): PublicSettingsContextValue {
  return useContext(PublicSettingsContext);
}
