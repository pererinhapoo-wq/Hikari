export interface DeviceBannerFraming {
  posX: number; // 0 to 100%
  posY: number; // 0 to 100%
  zoom: number; // 0.8 to 2.5
}

export interface AdminBannerSettings {
  mobile: DeviceBannerFraming;
  desktop: DeviceBannerFraming;
}

export const DEFAULT_BANNER_SETTINGS: AdminBannerSettings = {
  mobile: {
    posX: 50,
    posY: 0,
    zoom: 1,
  },
  desktop: {
    posX: 50,
    posY: 50,
    zoom: 1,
  },
};

const STORAGE_KEY = "hikari_admin_banner_settings_v1";

export function clamp(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min;
  return Math.min(Math.max(val, min), max);
}

export function sanitizeDeviceFraming(
  raw: unknown,
  fallback: DeviceBannerFraming,
): DeviceBannerFraming {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const obj = raw as Partial<DeviceBannerFraming>;

  return {
    posX:
      typeof obj.posX === "number"
        ? clamp(Math.round(obj.posX), 0, 100)
        : fallback.posX,
    posY:
      typeof obj.posY === "number"
        ? clamp(Math.round(obj.posY), 0, 100)
        : fallback.posY,
    zoom:
      typeof obj.zoom === "number"
        ? clamp(Math.round(obj.zoom * 100) / 100, 0.8, 2.5)
        : fallback.zoom,
  };
}

export function sanitizeBannerSettings(raw: unknown): AdminBannerSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_BANNER_SETTINGS };
  const obj = raw as Partial<AdminBannerSettings>;

  return {
    mobile: sanitizeDeviceFraming(obj.mobile, DEFAULT_BANNER_SETTINGS.mobile),
    desktop: sanitizeDeviceFraming(obj.desktop, DEFAULT_BANNER_SETTINGS.desktop),
  };
}

/**
 * Retorna as preferências em cache no localStorage (sincronização síncrona/otimista).
 */
export function getCachedAdminBannerSettings(): AdminBannerSettings {
  if (typeof window === "undefined") return DEFAULT_BANNER_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BANNER_SETTINGS;
    return sanitizeBannerSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_BANNER_SETTINGS;
  }
}

/**
 * Atualiza o cache local.
 */
export function setCachedAdminBannerSettings(settings: AdminBannerSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota errors
  }
}
