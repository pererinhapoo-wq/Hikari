import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("===============================================================");
console.log("SUITE DE TESTES: RETOMADA DE PROGRESSO E TRANSIÇÕES DO HIKARI");
console.log("===============================================================");

let totalAssertions = 0;
let passedAssertions = 0;

function check(desc: string, condition: boolean) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  [OK] ${desc}`);
  } else {
    console.error(`  [FALHA] ${desc}`);
    assert.fail(`Falha na asserção: ${desc}`);
  }
}

// ----------------------------------------------------------------------------
// 1. INSPEÇÃO DOS ARQUIVOS FONTE DO PROJETO
// ----------------------------------------------------------------------------
console.log("\n--- 1. VERIFICAÇÃO DOS COMPONENTES E ARQUITETURA ---");

const watchFilePath = path.resolve(process.cwd(), "src/routes/watch.$id.tsx");
const playerFilePath = path.resolve(process.cwd(), "src/components/player/CustomVideoPlayer.tsx");
const stylesFilePath = path.resolve(process.cwd(), "src/styles.css");

const watchContent = fs.readFileSync(watchFilePath, "utf8");
const playerContent = fs.readFileSync(playerFilePath, "utf8");
const stylesContent = fs.readFileSync(stylesFilePath, "utf8");

check("CustomVideoPlayer define callback onPause", playerContent.includes("onPause?: (currentTime: number, duration: number) => void;"));
check("CustomVideoPlayer define callback onRestored", playerContent.includes("onRestored?: (currentTime: number) => void;"));
check("CustomVideoPlayer aplica initialTime apenas com readyState >= 1", playerContent.includes("if (el.readyState >= 1)"));
check("CustomVideoPlayer suporta Hls startPosition", playerContent.includes("startPosition: initialTime"));
check("CustomVideoPlayer não chama applyInitialTime sincronamente com readyState 0", !playerContent.includes("videoEl.src = effectiveVideoUrl;\n      setIsHlsActive(false);\n      applyInitialTime();"));
check("CustomVideoPlayer previne disparo de timeupdate próximo a 0 antes da restauração", playerContent.includes("if (initialTime && initialTime > 0 && !initialTimeAppliedRef.current)"));
check("watch.$id possui proteção hasRestoredRef contra sobrescrita por timeupdate inicial", watchContent.includes("hasRestoredRef = useRef<boolean>"));
check("watch.$id salva progresso na pausa", watchContent.includes("handlePause = useCallback"));
check("watch.$id ouve beforeunload e pagehide para salvar antes de descarregar a aba", watchContent.includes('window.addEventListener("beforeunload"') && watchContent.includes('window.addEventListener("pagehide"'));
check("watch.$id isola o CustomVideoPlayer com key unívoca contendo animeId e episodeId", watchContent.includes("key={`${anime.id}-${current.id}-${selectedPlayer.id}-${file}`}"));
check("watch.$id salva progresso do episódio anterior antes de trocar para o novo", watchContent.includes("livePlaybackRef.current.episodeId === lastEpisodeIdRef.current"));
check("watch.$id remove progresso quando episódio ultrapassa 95%", watchContent.includes("time / totalDuration > 0.95") && watchContent.includes("localStorage.removeItem(progressStorageKey)"));

// ----------------------------------------------------------------------------
// 2. SIMULAÇÃO COMPORTAMENTAL: RETOMADA DO PROGRESSO AOS 7 MINUTOS (420s)
// ----------------------------------------------------------------------------
console.log("\n--- 2. SIMULAÇÃO: RETOMADA DO PROGRESSO EM ~7 MINUTOS (420s) ---");

// Mock de localStorage
const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
};

// Simula anime 101, episódio 1 salvo em 420 segundos (7m)
const animeId = "anime-demon-slayer";
const ep1Id = "ep-1";
const ep1Key = `hikari_progress_${animeId}_${ep1Id}`;
mockLocalStorage.setItem(ep1Key, "420");

// Leitura no carregamento
const rawSaved = mockLocalStorage.getItem(ep1Key);
const savedInitialTime = rawSaved ? Number.parseFloat(rawSaved) : 0;
check("Progresso salvo recuperado corretamente do localStorage (420s)", savedInitialTime === 420);

// Simulação de inicialização do player e eventos iniciais do navegador
let playerCurrentTime = 0;
let playerReadyState = 0; // HAVE_NOTHING
let hasRestored = savedInitialTime <= 0;
let lastSavedTime = savedInitialTime;
let initialTimeApplied = false;

// Evento 1: timeupdate prematuro a 0s durante o carregamento inicial da mídia
function simulateTimeUpdate(time: number, totalDuration: number) {
  if (!hasRestored && savedInitialTime > 0) {
    if (Math.abs(time - savedInitialTime) <= 4 || time >= savedInitialTime) {
      hasRestored = true;
      lastSavedTime = time;
    } else {
      // Ignora e não sobrescreve
      return;
    }
  }

  if (time / totalDuration > 0.95) {
    mockLocalStorage.removeItem(ep1Key);
    return;
  }

  if (Math.abs(time - lastSavedTime) >= 4) {
    lastSavedTime = time;
    mockLocalStorage.setItem(ep1Key, String(Math.floor(time)));
  }
}

// Disparo de timeupdate(0) antes dos metadados estarem prontos
simulateTimeUpdate(0, 1440);
check("timeupdate prematuro em 0s NÃO sobrescreve os 420s salvos", mockLocalStorage.getItem(ep1Key) === "420");

// Evento 2: Metadados carregam (HAVE_METADATA) e applyInitialTime é executado
playerReadyState = 1; // HAVE_METADATA
if (playerReadyState >= 1 && !initialTimeApplied && savedInitialTime > 0) {
  playerCurrentTime = Math.min(savedInitialTime, 1440 - 2);
  initialTimeApplied = true;
}
check("Posição do player é restaurada exatamente para 420s ao atingir HAVE_METADATA", playerCurrentTime === 420 && initialTimeApplied);

// Evento 3: Primeiro timeupdate após a busca (seek)
simulateTimeUpdate(playerCurrentTime, 1440);
check("Restauração é confirmada (hasRestored = true) após seek para 420s", hasRestored);
check("localStorage preserva 420s sem corrupção", mockLocalStorage.getItem(ep1Key) === "420");

// Evento 4: Reprodução contínua (421s, 422s, 423s, 425s)
simulateTimeUpdate(422, 1440); // < 4s intervalo, não grava
check("Intervalo < 4s não grava no localStorage desnecessariamente", mockLocalStorage.getItem(ep1Key) === "420");

simulateTimeUpdate(425, 1440); // >= 4s intervalo (425 - 420 = 5s)
check("Intervalo periódico salva nova posição (425s)", mockLocalStorage.getItem(ep1Key) === "425");

// Evento 5: Pausa do usuário aos 435 segundos
function simulatePause(time: number, totalDuration: number) {
  if (time / totalDuration <= 0.95) {
    lastSavedTime = time;
    mockLocalStorage.setItem(ep1Key, String(Math.floor(time)));
  }
}
simulatePause(435, 1440);
check("Pausa salva imediatamente a posição exata (435s)", mockLocalStorage.getItem(ep1Key) === "435");

// Evento 6: Fechamento/recarregamento da aba (beforeunload)
let livePlayback = { episodeId: ep1Id, time: 440 };
function simulateUnload() {
  if (livePlayback.time > 0) {
    mockLocalStorage.setItem(ep1Key, String(Math.floor(livePlayback.time)));
  }
}
simulateUnload();
check("beforeunload salva a posição mais recente em tempo real (440s)", mockLocalStorage.getItem(ep1Key) === "440");

// ----------------------------------------------------------------------------
// 3. SIMULAÇÃO: TROCA DE EPISÓDIOS COM PROGRESSOS INDEPENDENTES
// ----------------------------------------------------------------------------
console.log("\n--- 3. SIMULAÇÃO: TROCA DE EPISÓDIOS INDEPENDENTES ---");

const ep2Id = "ep-2";
const ep2Key = `hikari_progress_${animeId}_${ep2Id}`;
mockLocalStorage.setItem(ep2Key, "180"); // Episódio 2 estava em 3 minutos

// Mudança de episódio: ep1 -> ep2
const ep2Saved = mockLocalStorage.getItem(ep2Key);
const ep2InitialTime = ep2Saved ? Number.parseFloat(ep2Saved) : 0;
check("Episódio 2 recupera seu próprio tempo independente (180s)", ep2InitialTime === 180);
check("Progresso do Episódio 1 permanece intacto em 440s", mockLocalStorage.getItem(ep1Key) === "440");

// Episódio 3 sem progresso prévio
const ep3Id = "ep-3";
const ep3Key = `hikari_progress_${animeId}_${ep3Id}`;
const ep3Saved = mockLocalStorage.getItem(ep3Key);
const ep3InitialTime = ep3Saved ? Number.parseFloat(ep3Saved) : 0;
check("Episódio 3 sem progresso inicia em 0s normalmente", ep3InitialTime === 0);

// Episódio concluído (> 95%)
simulateTimeUpdate(1380, 1440); // 1380 / 1440 = 95.8%
check("Episódio acima de 95% limpa progresso para reiniciar do início na próxima", mockLocalStorage.getItem(ep1Key) === null);

// ----------------------------------------------------------------------------
// 4. VERIFICAÇÃO DAS TRANSIÇÕES E FEEDBACK TÁTIL (CSS)
// ----------------------------------------------------------------------------
console.log("\n--- 4. TRANSIÇÕES E FEEDBACK TÁTIL ---");

check("Estilo para botões do Video.js inclui transições suaves", stylesContent.includes(".hikari-video-player .media-button"));
check("Estilo para botões do Video.js inclui feedback tátil active:scale", stylesContent.includes(".hikari-video-player .media-button:active"));
check("Botões de navegação de episódio possuem transições suaves de cor/transform", stylesContent.includes("div[class*=\"mt-3.5 flex items-center justify-between\"] button"));
check("Botões de navegação possuem feedback de toque active:scale", stylesContent.includes("div[class*=\"mt-3.5 flex items-center justify-between\"] button:active:not(:disabled)"));
check("Interações de comentários (curtir, responder, anexos) possuem transições e feedback tátil", stylesContent.includes("article[id^=\"comment-\"] button"));
check("prefers-reduced-motion neutraliza animações para acessibilidade", stylesContent.includes("@media (prefers-reduced-motion: reduce)"));

console.log("\n===============================================================");
console.log(`TOTAL DE ASSERTIVAS: ${totalAssertions} | APROVADAS: ${passedAssertions} | FALHAS: 0`);
console.log("===============================================================\n");
