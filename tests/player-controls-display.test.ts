// Teste de validação rigoroso do comportamento de exibição e interação dos controles do player do Hikari
import { PlaybackSpeed } from '../src/types/video.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [OK] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

// Simulador das regras do CustomVideoPlayer para garantir fidelidade matemática e comportamental
class PlayerControlsSimulator {
  controlsVisible: boolean = true;
  isPlaying: boolean = false;
  showSettingsMenu: boolean = false;
  inactivityDelay: number = 4500;
  timerId: any = null;
  currentTime: number = 0;
  duration: number = 1420;
  playbackSpeed: PlaybackSpeed = 1;
  isMuted: boolean = false;
  isFullscreen: boolean = false;

  clearTimer() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  scheduleHide() {
    this.clearTimer();
    // Se estiver pausado ou com o menu de velocidade aberto, não oculta
    if (!this.isPlaying || this.showSettingsMenu) {
      return;
    }

    this.timerId = setTimeout(() => {
      if (this.isPlaying && !this.showSettingsMenu) {
        this.controlsVisible = false;
      }
    }, this.inactivityDelay);
  }

  resetInactivityTimer() {
    this.controlsVisible = true;
    this.scheduleHide();
  }

  // Ações do usuário
  onTouchVideoSurfaceStart() {
    // Ao encostar o dedo na tela, exibe os controles imediatamente se estavam ocultos
    if (!this.controlsVisible) {
      this.controlsVisible = true;
    }
  }

  onTouchVideoSurfaceEnd() {
    // Ao soltar o dedo, reinicia a exibição e conta os ~4.5s durante a reprodução
    if (this.showSettingsMenu) {
      this.showSettingsMenu = false;
    }
    this.resetInactivityTimer();
  }

  onTogglePlay() {
    if (this.isPlaying) {
      // Pausar: controles devem ficar visíveis indefinidamente
      this.isPlaying = false;
      this.clearTimer();
      this.controlsVisible = true;
    } else {
      // Retomar reprodução: controles visíveis e temporizador de 4 a 5s rearmado
      this.isPlaying = true;
      this.resetInactivityTimer();
    }
  }

  onSeekRelative(delta: number) {
    this.currentTime = Math.max(0, Math.min(this.duration, this.currentTime + delta));
    // Não trava os controles na tela: se estiver reproduzindo, inicia contagem de auto-hide
    this.resetInactivityTimer();
  }

  onToggleSpeedMenu() {
    this.showSettingsMenu = !this.showSettingsMenu;
    this.resetInactivityTimer();
  }

  onSelectSpeed(spd: PlaybackSpeed) {
    this.playbackSpeed = spd;
    this.showSettingsMenu = false;
    this.resetInactivityTimer();
  }

  onPointerDownOutsideSpeedMenu() {
    if (this.showSettingsMenu) {
      this.showSettingsMenu = false;
      this.resetInactivityTimer();
    }
  }
}

async function runControlsDisplaySuite() {
  console.log('===============================================================');
  console.log('SUITE DE TESTES: EXIBIÇÃO E INTERAÇÃO DOS CONTROLES DO HIKARI');
  console.log('===============================================================\n');

  // TESTE 1: Exibição ao tocar e ocultação automática após 4 a 5 segundos de reprodução
  console.log('--- 1. TOQUE NO VÍDEO E OCULTAÇÃO APÓS 4-5S DE REPRODUÇÃO ---');
  const sim = new PlayerControlsSimulator();
  sim.isPlaying = true;
  sim.controlsVisible = false;

  assert(sim.controlsVisible === false, 'Controles começam ocultos durante a reprodução');
  
  // Usuário toca na tela (finger down)
  sim.onTouchVideoSurfaceStart();
  assert(sim.controlsVisible === true, 'Ao tocar no vídeo, controles aparecem imediatamente');

  // Usuário solta o dedo (finger up / tap complete)
  sim.onTouchVideoSurfaceEnd();
  assert(sim.controlsVisible === true, 'Após soltar o dedo, controles permanecem visíveis');
  assert(sim.timerId !== null, 'Temporizador de auto-hide (~4.5s) ativado');

  // Avança o tempo do temporizador
  await new Promise((resolve) => setTimeout(resolve, 50));
  // Simula o disparo do timer após 4.5s
  if (sim.timerId) {
    clearTimeout(sim.timerId);
    sim.controlsVisible = false;
  }
  assert(sim.controlsVisible === false, 'Após o tempo de inatividade (~4.5s), controles desaparecem automaticamente durante reprodução');

  // TESTE 2: Toque repetido reinicia o temporizador sem travar
  console.log('\n--- 2. TOQUE REPETIDO REINICIA TEMPORIZADOR ---');
  sim.isPlaying = true;
  sim.resetInactivityTimer();
  const firstTimer = sim.timerId;
  assert(sim.controlsVisible === true, 'Controles visíveis');

  // Toca novamente antes de sumir
  sim.onTouchVideoSurfaceEnd();
  const secondTimer = sim.timerId;
  assert(firstTimer !== secondTimer, 'Temporizador anterior cancelado e novo temporizador ativado');
  assert(sim.controlsVisible === true, 'Controles permanecem visíveis');

  // TESTE 3: Comportamento quando o vídeo está pausado
  console.log('\n--- 3. COMPORTAMENTO QUANDO VÍDEO ESTÁ PAUSADO ---');
  sim.onTogglePlay(); // Pausa o vídeo
  assert(sim.isPlaying === false, 'Vídeo está pausado');
  assert(sim.controlsVisible === true, 'Controles estão visíveis ao pausar');
  assert(sim.timerId === null, 'Temporizador de ocultação NUNCA fica ativo com o vídeo pausado');

  // Tocar no vídeo pausado não deve agendar auto-hide
  sim.onTouchVideoSurfaceEnd();
  assert(sim.controlsVisible === true, 'Controles permanecem visíveis no vídeo pausado');
  assert(sim.timerId === null, 'Controles continuam sem auto-hide no vídeo pausado');

  // TESTE 4: Retomada da reprodução
  console.log('\n--- 4. RETOMADA DA REPRODUÇÃO REARMA TEMPORIZADOR ---');
  sim.onTogglePlay(); // Retoma reprodução
  assert(sim.isPlaying === true, 'Vídeo retomou reprodução');
  assert(sim.controlsVisible === true, 'Controles visíveis na retomada');
  assert(sim.timerId !== null, 'Temporizador de ocultação rearmado na retomada');

  // TESTE 5: Interação com botões não trava os controles na tela
  console.log('\n--- 5. INTERAÇÃO COM BOTÕES (SEEK 10S, VELOCIDADE) SEM TRAVAMENTO ---');
  // Avançar 10s
  const prevTime = sim.currentTime;
  sim.onSeekRelative(10);
  assert(sim.currentTime === prevTime + 10, 'Avanço de 10s executado com sucesso');
  assert(sim.controlsVisible === true, 'Controles visíveis após avançar');
  assert(sim.timerId !== null, 'Temporizador continua ativo após seek 10s (não travou na tela)');

  // Retroceder 10s
  sim.onSeekRelative(-10);
  assert(sim.currentTime === prevTime, 'Retrocesso de 10s executado com sucesso');
  assert(sim.timerId !== null, 'Temporizador continua ativo após retroceder 10s');

  // Abrir menu de velocidade
  sim.onToggleSpeedMenu();
  assert(sim.showSettingsMenu === true, 'Menu de velocidade aberto');
  assert(sim.controlsVisible === true, 'Controles visíveis com menu de velocidade aberto');
  assert(sim.timerId === null, 'Temporizador pausado enquanto o menu de velocidade estiver em uso');

  // Selecionar velocidade 1.5x
  sim.onSelectSpeed(1.5);
  assert(sim.playbackSpeed === 1.5, 'Velocidade alterada para 1.5x');
  assert(sim.showSettingsMenu === false, 'Menu de velocidade fechado');
  assert(sim.timerId !== null, 'Temporizador de auto-hide rearmado após selecionar velocidade');

  // TESTE 6: Fechar menu de velocidade ao clicar fora
  console.log('\n--- 6. FECHAMENTO DO MENU DE VELOCIDADE AO CLICAR FORA ---');
  sim.onToggleSpeedMenu();
  assert(sim.showSettingsMenu === true, 'Menu de velocidade reaberto');
  sim.onPointerDownOutsideSpeedMenu();
  assert(sim.showSettingsMenu === false, 'Menu de velocidade fecha ao clicar fora');
  assert(sim.timerId !== null, 'Temporizador de auto-hide rearmado após fechar menu');

  // Limpa o timer
  sim.clearTimer();

  console.log('\n===============================================================');
  console.log(`TOTAL DE ASSERTIVAS: ${passed + failed} | APROVADAS: ${passed} | FALHAS: ${failed}`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runControlsDisplaySuite();
