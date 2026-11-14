import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  isMaintenanceAdminRoute,
  isMaintenanceLoginRoute,
  resolveMaintenanceViewMode,
} from "./maintenance-guard.ts";

describe("resolveMaintenanceViewMode", () => {
  it("Cenário 1: manutenção desativada permite acesso normal para visitantes, comuns e admins", () => {
    for (const pathname of ["/", "/anime/1", "/watch/1/1", "/account", "/login"]) {
      assert.equal(
        resolveMaintenanceViewMode({
          pathname,
          maintenanceActive: false,
          allowAdminBypass: true,
          isServerVerifiedAdmin: false,
          isCheckingAdmin: false,
        }),
        "allowed",
      );
      assert.equal(
        resolveMaintenanceViewMode({
          pathname,
          maintenanceActive: false,
          allowAdminBypass: true,
          isServerVerifiedAdmin: true,
          isCheckingAdmin: false,
        }),
        "allowed",
      );
    }
  });

  it("Cenário 2: manutenção ativada bloqueia visitante não autenticado nas rotas públicas", () => {
    for (const pathname of ["/", "/anime/123", "/watch/123/1", "/calendar", "/browse/popular", "/account"]) {
      assert.equal(
        resolveMaintenanceViewMode({
          pathname,
          maintenanceActive: true,
          allowAdminBypass: true,
          isServerVerifiedAdmin: false,
          isCheckingAdmin: false,
        }),
        "blocked",
      );
    }
  });

  it("Cenário 3: manutenção ativada permite acesso completo ao administrador autenticado e verificado", () => {
    for (const pathname of ["/", "/anime/123", "/watch/123/1", "/account", "/login"]) {
      assert.equal(
        resolveMaintenanceViewMode({
          pathname,
          maintenanceActive: true,
          allowAdminBypass: true,
          isServerVerifiedAdmin: true,
          isCheckingAdmin: false,
        }),
        "allowed",
      );
    }
  });

  it("Cenário 4: manutenção ativada mantém /login acessível para autenticação sem bloquear", () => {
    assert.equal(isMaintenanceLoginRoute("/login"), true);
    assert.equal(isMaintenanceLoginRoute("/login/callback"), true);
    assert.equal(isMaintenanceLoginRoute("/account"), false);

    assert.equal(
      resolveMaintenanceViewMode({
        pathname: "/login",
        maintenanceActive: true,
        allowAdminBypass: true,
        isServerVerifiedAdmin: false,
        isCheckingAdmin: false,
      }),
      "login_isolated",
    );

    assert.equal(
      resolveMaintenanceViewMode({
        pathname: "/login",
        maintenanceActive: true,
        allowAdminBypass: true,
        isServerVerifiedAdmin: false,
        isCheckingAdmin: true,
      }),
      "login_isolated",
    );
  });

  it("Cenário 5: durante verificação server-side de usuário recém-logado, aguarda antes de bloquear (sem flash/loop)", () => {
    assert.equal(
      resolveMaintenanceViewMode({
        pathname: "/account",
        maintenanceActive: true,
        allowAdminBypass: true,
        isServerVerifiedAdmin: false,
        isCheckingAdmin: true,
      }),
      "checking_admin",
    );

    assert.equal(
      resolveMaintenanceViewMode({
        pathname: "/account",
        maintenanceActive: true,
        allowAdminBypass: true,
        isServerVerifiedAdmin: true,
        isCheckingAdmin: false,
      }),
      "allowed",
    );
  });

  it("Cenário 6: usuário comum autenticado continua bloqueado durante a manutenção", () => {
    for (const pathname of ["/", "/account", "/my-list", "/anime/10", "/watch/10/1"]) {
      assert.equal(
        resolveMaintenanceViewMode({
          pathname,
          maintenanceActive: true,
          allowAdminBypass: true,
          isServerVerifiedAdmin: false,
          isCheckingAdmin: false,
        }),
        "blocked",
      );
    }
  });

  it("Cenário 7: rotas /admin e /admin/maintenance permanecem acessíveis para o AdminGuard mesmo com bypass desativado", () => {
    assert.equal(isMaintenanceAdminRoute("/admin"), true);
    assert.equal(isMaintenanceAdminRoute("/admin/maintenance"), true);
    assert.equal(isMaintenanceAdminRoute("/admin-fake"), false);

    assert.equal(
      resolveMaintenanceViewMode({
        pathname: "/admin/maintenance",
        maintenanceActive: true,
        allowAdminBypass: false,
        isServerVerifiedAdmin: true,
        isCheckingAdmin: false,
      }),
      "admin_route",
    );
  });

  it("Cenário 8: após desativar a manutenção, visitantes recuperam acesso imediatamente", () => {
    assert.equal(
      resolveMaintenanceViewMode({
        pathname: "/",
        maintenanceActive: true,
        allowAdminBypass: true,
        isServerVerifiedAdmin: false,
        isCheckingAdmin: false,
      }),
      "blocked",
    );
    assert.equal(
      resolveMaintenanceViewMode({
        pathname: "/",
        maintenanceActive: false,
        allowAdminBypass: true,
        isServerVerifiedAdmin: false,
        isCheckingAdmin: false,
      }),
      "allowed",
    );
  });

  it("Cenário 9: botão 'Acessar com Conta Administrativa' foi completamente removido do shell.tsx", () => {
    const shellSource = readFileSync(
      resolve(process.cwd(), "src/components/shell.tsx"),
      "utf8",
    );
    assert.equal(
      shellSource.includes("Acessar com Conta Administrativa"),
      false,
    );
  });
});
