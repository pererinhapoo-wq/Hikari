export type AniListSyncRunStatus = "idle" | "running" | "completed" | "error";

export type AniListSyncExecutionMode = "background" | "chunked";

export interface AniListSyncCheckpointInfo {
  mode: "initial" | "incremental";
  stage: string;
  page: number;
  seasonIndex: number;
  startedAt: number | null;
  updatedAt: number | null;
}

export interface AniListSyncProgressInfo {
  stage: string | null;
  page: number | null;
  seasonIndex: number | null;
  totalProcessed: number;
  totalInserted: number;
  totalUpdated: number;
  importedSchedulesCount: number;
}

export interface AniListSyncStatusSnapshot {
  status: AniListSyncRunStatus;
  runId: string | null;
  mode: "initial" | "incremental" | null;
  startedAt: string | null;
  updatedAt: string | null;
  finishedAt: string | null;
  lastSuccessAt: string | null;
  errorMessage: string | null;
  incomplete: boolean;
  checkpoint: AniListSyncCheckpointInfo | null;
  initialCompleted: boolean;
  frequency: "1_per_week" | "2_per_week";
  executionMode: AniListSyncExecutionMode;
  needsStep: boolean;
  progress: AniListSyncProgressInfo | null;
}
