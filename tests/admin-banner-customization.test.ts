import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_BANNER_SETTINGS,
  clamp,
  sanitizeDeviceFraming,
  sanitizeBannerSettings,
  type AdminBannerSettings,
} from "../src/lib/banner-settings.ts";
import { isHikariAdmin } from "../src/lib/auth/admin.ts";

describe("Banner Settings & Framing Logic", () => {
  it("tem padrões definidos para celular e desktop", () => {
    assert.deepEqual(DEFAULT_BANNER_SETTINGS.mobile, {
      posX: 50,
      posY: 0,
      zoom: 1,
    });
    assert.deepEqual(DEFAULT_BANNER_SETTINGS.desktop, {
      posX: 50,
      posY: 50,
      zoom: 1,
    });
  });

  it("aplica clamp com segurança para limites numéricos", () => {
    assert.equal(clamp(150, 0, 100), 100);
    assert.equal(clamp(-20, 0, 100), 0);
    assert.equal(clamp(50, 0, 100), 50);
    assert.equal(clamp(NaN, 0, 100), 0);
  });

  it("sanitiza enquadramento por dispositivo respeitando limites seguros", () => {
    const fallback = DEFAULT_BANNER_SETTINGS.mobile;

    // Valores válidos
    const valid = sanitizeDeviceFraming({ posX: 30, posY: 75, zoom: 1.4 }, fallback);
    assert.equal(valid.posX, 30);
    assert.equal(valid.posY, 75);
    assert.equal(valid.zoom, 1.4);

    // Valores fora dos limites são travados (sem que a imagem desapareça)
    const outOfBounds = sanitizeDeviceFraming({ posX: 999, posY: -50, zoom: 10 }, fallback);
    assert.equal(outOfBounds.posX, 100);
    assert.equal(outOfBounds.posY, 0);
    assert.equal(outOfBounds.zoom, 2.5);

    // Zoom mínimo respeitado
    const underZoom = sanitizeDeviceFraming({ zoom: 0.2 }, fallback);
    assert.equal(underZoom.zoom, 0.8);

    // Valores nulos ou ausentes usam o fallback
    const invalid = sanitizeDeviceFraming(null, fallback);
    assert.deepEqual(invalid, fallback);
  });

  it("sanitiza configurações completas com independência de mobile e desktop", () => {
    const input = {
      mobile: { posX: 20, posY: 10, zoom: 1.2 },
      desktop: { posX: 80, posY: 60, zoom: 1.8 },
    };

    const sanitized = sanitizeBannerSettings(input);
    assert.equal(sanitized.mobile.posX, 20);
    assert.equal(sanitized.mobile.posY, 10);
    assert.equal(sanitized.mobile.zoom, 1.2);

    assert.equal(sanitized.desktop.posX, 80);
    assert.equal(sanitized.desktop.posY, 60);
    assert.equal(sanitized.desktop.zoom, 1.8);
  });
});

describe("Autorização Administrativa", () => {
  it("autoriza contas administrativas oficiais", () => {
    assert.equal(isHikariAdmin("pererinhapoo@gmail.com"), true);
    assert.equal(isHikariAdmin("matheuss4243@gmail.com"), true);
    assert.equal(isHikariAdmin("matheuspererinhaholtmail@gmail.com"), true);
    assert.equal(isHikariAdmin("MATHEUSPERERINHAHOLTMAIL@GMAIL.COM"), true);
  });

  it("bloqueia contas de visitantes e usuários não autorizados", () => {
    assert.equal(isHikariAdmin("usuario_comum@gmail.com"), false);
    assert.equal(isHikariAdmin("hacker@attack.com"), false);
    assert.equal(isHikariAdmin(""), false);
    assert.equal(isHikariAdmin(null), false);
    assert.equal(isHikariAdmin(undefined), false);
  });

  it("permite o usuário de desenvolvimento para preview/testes locais", () => {
    assert.equal(isHikariAdmin("dev@example.com"), true);
  });
});
