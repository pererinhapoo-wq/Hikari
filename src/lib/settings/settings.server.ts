import { getSql } from "@/lib/db";
import {
  type HikariAdminSettings,
  type HikariPublicSettings,
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_PUBLIC_SETTINGS,
  adminSettingsSchema,
} from "./settings-types";

let cachedPublicSettings: HikariPublicSettings | null = null;
let lastPublicCacheTime = 0;
const PUBLIC_CACHE_TTL_MS = 60 * 1000; // 60s cache

export function invalidatePublicSettingsCache(): void {
  cachedPublicSettings = null;
  lastPublicCacheTime = 0;
}

export async function loadAllSettingsFromDb(): Promise<HikariAdminSettings> {
  try {
    const sql = await getSql();

    const rows = await sql.query<{ key: string; value: string }>(
      `SELECT "key", "value" FROM "admin_settings";`,
    );

    const dbMap = new Map<string, unknown>();
    for (const r of rows) {
      try {
        dbMap.set(r.key, JSON.parse(r.value));
      } catch {
        dbMap.set(r.key, r.value);
      }
    }

    const merged: Record<string, unknown> = { ...DEFAULT_ADMIN_SETTINGS };
    for (const [k, v] of dbMap.entries()) {
      if (k in DEFAULT_ADMIN_SETTINGS && v !== undefined && v !== null) {
        merged[k] = v;
      }
    }

    const parseResult = adminSettingsSchema.safeParse(merged);
    if (parseResult.success) {
      return parseResult.data;
    }

    console.warn(
      "[settings.server] Schema validation fallback na leitura de admin_settings:",
      parseResult.error,
    );
    return DEFAULT_ADMIN_SETTINGS;
  } catch (err) {
    console.warn("[settings.server] Erro ao consultar admin_settings do PostgreSQL:", err);
    return DEFAULT_ADMIN_SETTINGS;
  }
}

export async function saveSettingsToDb(
  updates: Partial<HikariAdminSettings>,
): Promise<HikariAdminSettings> {
  const sql = await getSql();

  const entries = Object.entries(updates).filter(
    ([k, v]) => k in DEFAULT_ADMIN_SETTINGS && v !== undefined,
  );

  if (entries.length === 0) {
    return loadAllSettingsFromDb();
  }

  for (const [key, value] of entries) {
    const strValue = JSON.stringify(value);
    await sql.query(
      `INSERT INTO "admin_settings" ("key", "value", "createdAt", "updatedAt")
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("key") DO UPDATE
       SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP;`,
      [key, strValue],
    );
  }

  invalidatePublicSettingsCache();
  return loadAllSettingsFromDb();
}

export async function loadPublicSettingsFromDb(): Promise<HikariPublicSettings> {
  const now = Date.now();
  if (cachedPublicSettings && now - lastPublicCacheTime < PUBLIC_CACHE_TTL_MS) {
    return cachedPublicSettings;
  }

  try {
    const all = await loadAllSettingsFromDb();
    const publicSettings: HikariPublicSettings = {
      site_name: all.site_name || DEFAULT_PUBLIC_SETTINGS.site_name,
      site_description:
        all.site_description || DEFAULT_PUBLIC_SETTINGS.site_description,
      site_slogan: all.site_slogan || DEFAULT_PUBLIC_SETTINGS.site_slogan,
      site_contact_email:
        all.site_contact_email || DEFAULT_PUBLIC_SETTINGS.site_contact_email,
      site_favicon_url:
        all.site_favicon_url || DEFAULT_PUBLIC_SETTINGS.site_favicon_url,
      default_language: all.default_language,
      preferred_title_language: all.preferred_title_language,
      notice: {
        enabled: Boolean(all.notice_enabled),
        title: all.notice_title || "",
        content: all.notice_content || "",
        type: all.notice_type || "info",
        dismissible: all.notice_dismissible !== false,
      },
      modules: {
        comments: all.module_comments_enabled !== false,
        ai: all.module_ai_enabled !== false,
        adult: all.module_adult_enabled !== false,
        calendar: all.module_calendar_enabled !== false,
      },
    };

    cachedPublicSettings = publicSettings;
    lastPublicCacheTime = now;
    return publicSettings;
  } catch (err) {
    console.warn("[settings.server] Falha ao montar configurações públicas:", err);
    return DEFAULT_PUBLIC_SETTINGS;
  }
}
