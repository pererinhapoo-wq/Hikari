import { z } from "zod";

export interface HikariAdminSettings {
  // A. Identidade e informações do site
  site_name: string;
  site_description: string;
  site_slogan: string;
  site_contact_email: string;
  site_favicon_url: string;

  // B. Preferências gerais
  default_language: "pt-BR" | "en-US" | "ja-JP";
  preferred_title_language: "romaji" | "english" | "native";
  player_autoplay_default: boolean;
  player_auto_next_default: boolean;
  allow_adult_content: boolean;

  // C. Avisos e comunicados
  notice_enabled: boolean;
  notice_title: string;
  notice_content: string;
  notice_type: "info" | "warning" | "maintenance" | "success";
  notice_dismissible: boolean;

  // D. Recursos e módulos
  module_comments_enabled: boolean;
  module_ai_enabled: boolean;
  module_adult_enabled: boolean;
  module_calendar_enabled: boolean;
}

export interface HikariPublicSettings {
  site_name: string;
  site_description: string;
  site_slogan: string;
  site_contact_email: string;
  site_favicon_url: string;
  default_language: "pt-BR" | "en-US" | "ja-JP";
  preferred_title_language: "romaji" | "english" | "native";
  notice: {
    enabled: boolean;
    title: string;
    content: string;
    type: "info" | "warning" | "maintenance" | "success";
    dismissible: boolean;
  };
  modules: {
    comments: boolean;
    ai: boolean;
    adult: boolean;
    calendar: boolean;
  };
}

export const DEFAULT_ADMIN_SETTINGS: HikariAdminSettings = {
  site_name: "Hikari",
  site_description:
    "Plataforma de catálogo, acompanhamento e transmissão de animes com interface veloz, moderna e comunidade ativa.",
  site_slogan: "Seu portal definitivo para streaming e catálogo de animes",
  site_contact_email: "contato@hikari.tv",
  site_favicon_url: "/favicon.svg",

  default_language: "pt-BR",
  preferred_title_language: "romaji",
  player_autoplay_default: true,
  player_auto_next_default: true,
  allow_adult_content: true,

  notice_enabled: false,
  notice_title: "Aviso da Administração",
  notice_content:
    "Bem-vindo ao Hikari! Manutenção preventiva e atualizações programadas.",
  notice_type: "info",
  notice_dismissible: true,

  module_comments_enabled: true,
  module_ai_enabled: true,
  module_adult_enabled: true,
  module_calendar_enabled: true,
};

export const DEFAULT_PUBLIC_SETTINGS: HikariPublicSettings = {
  site_name: DEFAULT_ADMIN_SETTINGS.site_name,
  site_description: DEFAULT_ADMIN_SETTINGS.site_description,
  site_slogan: DEFAULT_ADMIN_SETTINGS.site_slogan,
  site_contact_email: DEFAULT_ADMIN_SETTINGS.site_contact_email,
  site_favicon_url: DEFAULT_ADMIN_SETTINGS.site_favicon_url,
  default_language: DEFAULT_ADMIN_SETTINGS.default_language,
  preferred_title_language: DEFAULT_ADMIN_SETTINGS.preferred_title_language,
  notice: {
    enabled: DEFAULT_ADMIN_SETTINGS.notice_enabled,
    title: DEFAULT_ADMIN_SETTINGS.notice_title,
    content: DEFAULT_ADMIN_SETTINGS.notice_content,
    type: DEFAULT_ADMIN_SETTINGS.notice_type,
    dismissible: DEFAULT_ADMIN_SETTINGS.notice_dismissible,
  },
  modules: {
    comments: DEFAULT_ADMIN_SETTINGS.module_comments_enabled,
    ai: DEFAULT_ADMIN_SETTINGS.module_ai_enabled,
    adult: DEFAULT_ADMIN_SETTINGS.module_adult_enabled,
    calendar: DEFAULT_ADMIN_SETTINGS.module_calendar_enabled,
  },
};

export const adminSettingsSchema = z.object({
  site_name: z
    .string()
    .trim()
    .min(1, "Nome do site é obrigatório")
    .max(64, "Nome muito longo (máx. 64 caracteres)"),
  site_description: z
    .string()
    .trim()
    .max(500, "Descrição muito longa (máx. 500 caracteres)"),
  site_slogan: z
    .string()
    .trim()
    .max(160, "Slogan muito longo (máx. 160 caracteres)"),
  site_contact_email: z
    .string()
    .trim()
    .max(128)
    .refine(
      (val) => val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      "E-mail de contato inválido",
    ),
  site_favicon_url: z
    .string()
    .trim()
    .max(255, "URL do favicon muito longa"),

  default_language: z.enum(["pt-BR", "en-US", "ja-JP"]),
  preferred_title_language: z.enum(["romaji", "english", "native"]),
  player_autoplay_default: z.boolean(),
  player_auto_next_default: z.boolean(),
  allow_adult_content: z.boolean(),

  notice_enabled: z.boolean(),
  notice_title: z
    .string()
    .trim()
    .max(128, "Título do aviso muito longo (máx. 128 caracteres)"),
  notice_content: z
    .string()
    .trim()
    .max(1000, "Conteúdo do aviso muito longo (máx. 1000 caracteres)"),
  notice_type: z.enum(["info", "warning", "maintenance", "success"]),
  notice_dismissible: z.boolean(),

  module_comments_enabled: z.boolean(),
  module_ai_enabled: z.boolean(),
  module_adult_enabled: z.boolean(),
  module_calendar_enabled: z.boolean(),
});

export const updateAdminSettingsSchema = adminSettingsSchema.partial();
