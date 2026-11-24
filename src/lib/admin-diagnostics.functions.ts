import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "@/lib/auth/middleware";

export type DiagnosticStatus =
  | "SAUDÁVEL"
  | "ATENÇÃO"
  | "CRÍTICO"
  | "NÃO VERIFICADO"
  | "INDISPONÍVEL";

export interface DatabaseDiagnosticProbe {
  status: DiagnosticStatus;
  backend: "neon" | "pglite";
  backendLabel: string;
  connected: boolean;
  latencyMs: number | null;
  summary: string;
  detail: string;
}

export interface RedisDiagnosticProbe {
  status: DiagnosticStatus;
  configured: boolean;
  connected: boolean;
  latencyMs: number | null;
  summary: string;
  detail: string;
}

export interface RuntimeDiagnosticSnapshot {
  nodeVersion: string;
  platform: string;
  arch: string;
  uptimeSeconds: number;
  rssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  environment: string;
}

export interface CommandCenterDiagnosticsReport {
  overallStatus: DiagnosticStatus;
  overallTitle: string;
  overallMessage: string;
  checkedAt: string;
  probeDurationMs: number;
  activeProbesCount: number;
  totalSubsystemsCount: number;
  database: DatabaseDiagnosticProbe;
  redis: RedisDiagnosticProbe;
  runtime: RuntimeDiagnosticSnapshot;
}

let inFlightDiagnostics: Promise<CommandCenterDiagnosticsReport> | null = null;

function buildUnexpectedFailureReport(): CommandCenterDiagnosticsReport {
  return {
    overallStatus: "CRÍTICO",
    overallTitle: "FALHA AO EXECUTAR SONDAS",
    overallMessage:
      "Não foi possível concluir a verificação de infraestrutura no servidor. Tente novamente em instantes.",
    checkedAt: new Date().toISOString(),
    probeDurationMs: 0,
    activeProbesCount: 2,
    totalSubsystemsCount: 4,
    database: {
      status: "CRÍTICO",
      backend: "neon",
      backendLabel: "PostgreSQL",
      connected: false,
      latencyMs: null,
      summary: "Sonda de banco não concluída",
      detail: "Erro interno ao executar verificação de banco de dados.",
    },
    redis: {
      status: "INDISPONÍVEL",
      configured: false,
      connected: false,
      latencyMs: null,
      summary: "Sonda Redis não concluída",
      detail: "Não foi possível avaliar o estado do Upstash Redis.",
    },
    runtime: {
      nodeVersion: "unknown",
      platform: "unknown",
      arch: "unknown",
      uptimeSeconds: 0,
      rssMb: 0,
      heapUsedMb: 0,
      heapTotalMb: 0,
      environment: "unknown",
    },
  };
}

/**
 * Server Function GET protegida por `adminMiddleware` para executar sondas leves
 * e sob demanda de Neon PostgreSQL e Upstash Redis na Central de Diagnóstico.
 * Deduplica execuções simultâneas em voo para evitar sobrecarga.
 */
export const getCommandCenterDiagnostics = createServerFn({
  method: "GET",
})
  .middleware([adminMiddleware])
  .handler(async (): Promise<CommandCenterDiagnosticsReport> => {
    if (inFlightDiagnostics) {
      return inFlightDiagnostics;
    }

    let flightPromise: Promise<CommandCenterDiagnosticsReport> | null = null;
    const promise = (async (): Promise<CommandCenterDiagnosticsReport> => {
      try {
        const { collectCommandCenterDiagnostics } = await import(
          "@/lib/admin-diagnostics.server"
        );
        return await collectCommandCenterDiagnostics();
      } catch {
        return buildUnexpectedFailureReport();
      } finally {
        if (inFlightDiagnostics === flightPromise) {
          inFlightDiagnostics = null;
        }
      }
    })();

    flightPromise = promise;
    inFlightDiagnostics = promise;
    return promise;
  });
