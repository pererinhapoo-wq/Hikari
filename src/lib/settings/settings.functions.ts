import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "@/lib/auth/middleware";
import {
  type HikariAdminSettings,
  type HikariPublicSettings,
  DEFAULT_PUBLIC_SETTINGS,
  updateAdminSettingsSchema,
} from "./settings-types";

/**
 * Server Function pública para recuperar apenas as configurações públicas e seguras do site.
 * Utilizada pelo Root Loader e componentes da área pública.
 */
export const getPublicSettings = createServerFn({
  method: "GET",
}).handler(async (): Promise<HikariPublicSettings> => {
  try {
    const { loadPublicSettingsFromDb } = await import("./settings.server");
    return await loadPublicSettingsFromDb();
  } catch (err) {
    console.warn("[settings.functions] Falha segura ao carregar public settings:", err);
    return DEFAULT_PUBLIC_SETTINGS;
  }
});

/**
 * Server Function administrativa para carregar todas as configurações globais do Neon PostgreSQL.
 * Valida estritamente a sessão e privilégios de administrador via adminMiddleware.
 */
export const getAdminSettings = createServerFn({
  method: "GET",
})
  .middleware([adminMiddleware])
  .handler(async (): Promise<HikariAdminSettings> => {
    const { loadAllSettingsFromDb } = await import("./settings.server");
    return await loadAllSettingsFromDb();
  });

/**
 * Server Function administrativa para salvar alterações nas configurações globais.
 * Valida no servidor via adminMiddleware e Zod schema.
 */
export const saveAdminSettings = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .validator((data: unknown) => {
    return updateAdminSettingsSchema.parse(data);
  })
  .handler(async ({ data }): Promise<HikariAdminSettings> => {
    const { saveSettingsToDb } = await import("./settings.server");
    return await saveSettingsToDb(data);
  });
