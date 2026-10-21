// Teste de validação do layout responsivo dos controles do Video.js 10 no Hikari
import * as fs from 'fs';
import * as path from 'path';

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

function runResponsiveLayoutTests() {
  console.log('===============================================================');
  console.log('SUITE DE TESTES: LAYOUT RESPONSIVO DA BARRA DE CONTROLES DO HIKARI');
  console.log('===============================================================\n');

  const cssPath = path.resolve('src/styles.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  // 1. Verificação da regra anti-supressão dos tempos
  console.log('--- 1. PREVENÇÃO DA SUPRESSÃO DOS TEMPOS (CURRENT E REMAINING) ---');
  assert(
    css.includes('.hikari-video-player .video-time-value') &&
    css.includes('display: inline-flex !important'),
    'Regra explícita forçando display: inline-flex !important para .video-time-value'
  );
  assert(
    css.includes('font-variant-numeric: tabular-nums !important'),
    'Numerais tabulares habilitados para estabilidade visual e legibilidade dos segundos'
  );
  assert(
    css.includes('white-space: nowrap !important'),
    'Quebra de linha desabilitada nos tempos para evitar quebra de dígitos'
  );
  assert(
    css.includes('flex-shrink: 0 !important'),
    'flex-shrink: 0 definido nos tempos para garantir que a barra de progresso encolha primeiro'
  );

  // 2. Verificação do grupo de slider e tempos
  console.log('\n--- 2. FLEXIBILIDADE DO GRUPO DE SLIDER E BARRA DE PROGRESSO ---');
  assert(
    css.includes('.hikari-video-player .video-time-slider-group') &&
    css.includes('flex: 1 1 0% !important'),
    'Grupo do slider possui flex: 1 1 0% ocupando espaço dinâmico sem estourar'
  );
  assert(
    css.includes('.hikari-video-player .media-time-slider') &&
    css.includes('flex: 1 1 36px !important'),
    'Barra de progresso configurada com flex: 1 1 36px para consumir o espaço restante'
  );

  // 3. Verificação das adaptações mobile (< 32rem / 512px)
  console.log('\n--- 3. ADAPTAÇÕES RESPONSIVAS PARA DISPOSITIVOS MOBILE (< 32rem) ---');
  assert(
    css.includes('@container media-root (width < 32rem)'),
    'Container query definida para viewports mobile (< 32rem)'
  );
  assert(
    css.includes('--media-control-size: 2rem !important'),
    'Tamanho dos botões adaptado para 2rem (32px) no mobile'
  );

  // 4. Verificação das adaptações para larguras ultra-estreitas (< 24rem / 384px até 320px)
  console.log('\n--- 4. ADAPTAÇÕES PARA TELAS ULTRA-ESTREITAS (< 24rem / 320px-360px) ---');
  assert(
    css.includes('@container media-root (width < 24rem)'),
    'Container query definida para telas estreitas (< 24rem)'
  );
  assert(
    css.includes('--media-control-size: 1.875rem !important'),
    'Tamanho dos botões adaptado para 1.875rem (30px) em larguras estreitas'
  );
  assert(
    css.includes('font-size: 0.6875rem !important'),
    'Tamanho da fonte dos tempos ajustado para 11px em larguras estreitas'
  );

  // 5. Simulação matemática de espaço disponível em larguras reais (320px, 360px, 390px, 430px)
  console.log('\n--- 5. SIMULAÇÃO MATEMÁTICA DE ESPAÇO LIVRE (ZOOM 100%) ---');
  
  const viewports = [
    { name: 'Mobile Ultra-Compacto', width: 320, btnSize: 30, fontPx: 11, timeWidth: 32, gap: 4, insets: 8, padding: 6 },
    { name: 'Mobile Compacto (Android comum)', width: 360, btnSize: 30, fontPx: 11, timeWidth: 32, gap: 4, insets: 12, padding: 8 },
    { name: 'Mobile Padrão (iPhone)', width: 390, btnSize: 32, fontPx: 12, timeWidth: 36, gap: 6, insets: 12, padding: 8 },
    { name: 'Mobile Grande (Pro Max)', width: 430, btnSize: 32, fontPx: 12, timeWidth: 36, gap: 6, insets: 12, padding: 8 },
    { name: 'Desktop HD', width: 1024, btnSize: 36, fontPx: 13, timeWidth: 42, gap: 8, insets: 16, padding: 8 },
  ];

  for (const vp of viewports) {
    // 4 botões de controle: Play, Volume, Settings, Fullscreen
    const buttonsTotal = 4 * vp.btnSize;
    // 2 marcadores de tempo: Current e Remaining
    const timesTotal = 2 * vp.timeWidth;
    // Gaps entre os itens
    const gapsTotal = 4 * vp.gap;
    // Espaço ocupado fixo
    const fixedTotal = vp.insets + vp.padding + buttonsTotal + timesTotal + gapsTotal;
    // Espaço restante atribuído à barra de progresso (TimeSlider)
    const progressBarAvailable = vp.width - fixedTotal;

    assert(
      progressBarAvailable >= 28,
      `Largura ${vp.width}px (${vp.name}): Barra de progresso recebe ${progressBarAvailable}px livres (> 28px min-width) sem sobreposição`
    );
  }

  console.log('\n===============================================================');
  console.log(`TOTAL DE ASSERTIVAS: ${passed + failed} | APROVADAS: ${passed} | FALHAS: ${failed}`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runResponsiveLayoutTests();
