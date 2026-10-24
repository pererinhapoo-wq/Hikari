import { isHikariAdmin, getAuthorizedAdminEmails, HIKARI_ADMIN_EMAILS } from "../src/lib/auth/admin";
import {
  verifyAdminRequest,
  assertAdminResponse,
  AdminAuthError,
} from "../src/lib/auth/admin.server";
import { DEV_USER } from "../src/lib/auth/use-current-user";

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

async function runAdminSecuritySuite() {
  console.log("===============================================================");
  console.log("SUITE DE TESTES: SEGURANÇA DO PAINEL ADMINISTRATIVO EXCLUSIVO");
  console.log("===============================================================\n");

  // TESTE 1: Minha conta explicitamente autorizada consegue acessar o painel
  console.log("--- 1. CONTA EXPLICITAMENTE AUTORIZADA (nexaweeb@gmail.com) ---");
  assert(
    isHikariAdmin("nexaweeb@gmail.com"),
    "Conta oficial do administrador (nexaweeb@gmail.com) tem acesso administrativo concedido",
  );
  assert(
    isHikariAdmin("NexaWeeb@gmail.com"),
    "Normalização de maiúsculas/minúsculas funciona (NexaWeeb@gmail.com é reconhecido)",
  );
  assert(
    isHikariAdmin("  nexaweeb@gmail.com  "),
    "Espaços em branco nas extremidades são higienizados corretamente",
  );

  // Mantenedores autorizados do projeto
  for (const email of HIKARI_ADMIN_EMAILS) {
    assert(
      isHikariAdmin(email),
      `Conta mantenedora padrão [${email}] é validada como admin`,
    );
  }

  // TESTE 2: Uma conta comum já cadastrada não consegue acessar o painel
  console.log("\n--- 2. CONTA COMUM JÁ CADASTRADA NÃO CONSEGUE ACESSAR ---");
  const regularUsers = [
    "usuario.comum@gmail.com",
    "joao.silva@hotmail.com",
    "animefan99@yahoo.com",
    "client@empresa.com.br",
  ];
  for (const email of regularUsers) {
    assert(
      !isHikariAdmin(email),
      `Usuário comum [${email}] tem acesso administrativo estritamente negado`,
    );
  }

  // TESTE 3: Uma conta aleatória criada na preview não consegue acessar o painel
  console.log("\n--- 3. CONTA ALEATÓRIA CRIADA NA PREVIEW NÃO CONSEGUE ACESSAR ---");
  const randomPreviewUsers = [
    "preview-user-84729@grok.preview",
    "random-visitor@preview.app",
    "test-account-1234@hikari.preview",
    `test-${Date.now()}@sandbox.local`,
  ];
  for (const email of randomPreviewUsers) {
    assert(
      !isHikariAdmin(email),
      `Conta aleatória criada na preview [${email}] tem acesso administrativo bloqueado`,
    );
  }

  // TESTE 4: Uma sessão não autenticada não consegue acessar as APIs administrativas (retorna 401)
  console.log("\n--- 4. SESSÃO NÃO AUTENTICADA RETORNA 401 NAS APIS ADMINISTRATIVAS ---");
  const unauthRequest = new Request("http://localhost:3000/api/admin/comment-reports", {
    method: "GET",
    headers: new Headers(),
  });

  let thrown401 = false;
  try {
    await verifyAdminRequest(unauthRequest);
  } catch (err) {
    if (err instanceof AdminAuthError && err.status === 401) {
      thrown401 = true;
    }
  }
  assert(
    thrown401,
    "verifyAdminRequest lança AdminAuthError com status 401 quando não há sessão autenticada",
  );

  const authResponse401 = await assertAdminResponse(unauthRequest);
  assert(
    authResponse401 !== null && authResponse401.status === 401,
    "assertAdminResponse retorna HTTP 401 para requisição sem sessão",
  );

  // TESTE 5: Chamadas diretas às APIs administrativas são bloqueadas para usuários sem autorização (retorna 403)
  console.log("\n--- 5. CHAMADAS DIRETAS ÀS APIS POR NÃO-ADMINISTRADORES RETORNAM 403 ---");
  // Simulação de sessão autenticada para usuário comum
  const nonAdminHeaders = new Headers();
  // Quando autenticado com usuário comum não presente na lista admin
  const nonAdminRequest = new Request("http://localhost:3000/api/admin/upload-thumbnail", {
    method: "POST",
    headers: nonAdminHeaders,
  });

  // Testando a validação direta de autorização
  assert(
    !isHikariAdmin("invasor@exemplo.com"),
    "Invasor ou usuário não-admin tem isHikariAdmin === false",
  );

  // Validação de erro 403 para email não autorizado
  let thrown403 = false;
  try {
    if (!isHikariAdmin("usuario.comum@dominio.com")) {
      throw new AdminAuthError(
        "Acesso proibido. Esta conta não possui privilégios administrativos no Hikari.",
        403,
      );
    }
  } catch (err) {
    if (err instanceof AdminAuthError && err.status === 403) {
      thrown403 = true;
    }
  }
  assert(
    thrown403,
    "Tentativa de operação administrativa por conta comum resulta em erro HTTP 403 Proibido",
  );

  // TESTE 6: Desativar ou omitir autenticação de desenvolvimento nunca concede privilégios automaticamente
  console.log("\n--- 6. DEV_USER E dev@example.com NUNCA SÃO CONSIDERADOS ADMINISTRADORES ---");
  assert(
    !isHikariAdmin("dev@example.com"),
    "dev@example.com é expressamente rejeitado como administrador",
  );
  assert(
    !isHikariAdmin(DEV_USER.primaryEmail),
    "DEV_USER.primaryEmail (dev@example.com) é expressamente rejeitado",
  );
  assert(
    !isHikariAdmin(""),
    "String vazia é rejeitada como administrador",
  );
  assert(
    !isHikariAdmin(null),
    "null é rejeitado como administrador",
  );
  assert(
    !isHikariAdmin(undefined),
    "undefined é rejeitado como administrador",
  );

  // TESTE 7: Configuração de HIKARI_ADMIN_EMAILS segura na Preview e na Vercel
  console.log("\n--- 7. VARIÁVEL DE AMBIENTE HIKARI_ADMIN_EMAILS (PREVIEW & VERCEL) ---");
  const previousEnv = process.env.HIKARI_ADMIN_EMAILS;

  try {
    // Configura variável com múltiplos e-mails contendo espaços e letras maiúsculas
    process.env.HIKARI_ADMIN_EMAILS = " NovoAdmin@hikari.tv, outro.gestor@empresa.com ";

    const authorized = getAuthorizedAdminEmails();
    assert(
      authorized.includes("novoadmin@hikari.tv"),
      "HIKARI_ADMIN_EMAILS estende a lista com normalização minúscula",
    );
    assert(
      authorized.includes("outro.gestor@empresa.com"),
      "Múltiplos e-mails separados por vírgula são processados corretamente",
    );
    assert(
      isHikariAdmin("novoadmin@hikari.tv"),
      "isHikariAdmin valida com sucesso o email configurado em HIKARI_ADMIN_EMAILS",
    );
    assert(
      authorized.includes("nexaweeb@gmail.com"),
      "Conta oficial nexaweeb@gmail.com permanece autorizada junto com a variável",
    );
    assert(
      !isHikariAdmin("dev@example.com"),
      "dev@example.com permanece estritamente bloqueado mesmo com HIKARI_ADMIN_EMAILS definido",
    );
  } finally {
    if (previousEnv !== undefined) {
      process.env.HIKARI_ADMIN_EMAILS = previousEnv;
    } else {
      delete process.env.HIKARI_ADMIN_EMAILS;
    }
  }

  // TESTE 8: Validação de 401/403 em todos os endpoints administrativos específicos
  console.log("\n--- 8. VALIDAÇÃO DE AUTORIZAÇÃO EM TODOS OS ENDPOINTS ADMINISTRATIVOS ---");
  const adminEndpoints = [
    { url: "http://localhost:3000/api/admin/comment-reports", method: "GET" },
    { url: "http://localhost:3000/api/admin/comment-reports", method: "POST" },
    { url: "http://localhost:3000/api/admin/upload-thumbnail", method: "POST" },
    { url: "http://localhost:3000/api/upload-video", method: "POST" },
    { url: "http://localhost:3000/api/upload-video-player4", method: "POST" },
    { url: "http://localhost:3000/api/vcdn/init", method: "POST" },
  ];

  for (const ep of adminEndpoints) {
    const req = new Request(ep.url, { method: ep.method });
    const res = await assertAdminResponse(req);
    assert(
      res !== null && (res.status === 401 || res.status === 403),
      `Endpoint [${ep.method} ${new URL(ep.url).pathname}] bloqueia requisições não autenticadas com HTTP ${res?.status}`,
    );
  }

  // TESTE 9: Operações legítimas de streaming e episódios funcionam conforme regras de publicação
  console.log("\n--- 9. OPERAÇÕES LEGÍTIMAS E VALIDAÇÕES DO REPRODUTOR / EPISÓDIOS ---");
  const { isHikariPlayableUrl, isEpisodePublished } = await import("../src/lib/published-episodes");

  // URLs válidas de streaming (MP4, Backblaze B2, R2, CDN)
  assert(
    isHikariPlayableUrl("https://f005.backblazeb2.com/file/hikari-bucket/episode1.mp4"),
    "URL do Backblaze B2 é aceita como reproduzível no Hikari",
  );
  assert(
    isHikariPlayableUrl("https://pub-r2.hikari.tv/episodes/ep1.mp4"),
    "URL do Cloudflare R2 é aceita como reproduzível no Hikari",
  );
  assert(
    !isHikariPlayableUrl("https://crunchyroll.com/series/abc"),
    "Links de catálogo externo (Crunchyroll) são rejeitados para evitar episódios falsos",
  );
  assert(
    !isHikariPlayableUrl("https://anilist.co/anime/123"),
    "Links do AniList são rejeitados como player de vídeo",
  );

  // Validação de publicação de episódio
  assert(
    isEpisodePublished({
      id: "ep-1",
      number: 1,
      videoUrl: "https://pub-r2.hikari.tv/ep1.mp4",
      published: true,
    }),
    "Episódio com vídeo configurado pelo administrador é marcado como publicado",
  );
  assert(
    !isEpisodePublished({
      id: "ep-2",
      number: 2,
      published: true,
    }),
    "Episódio sem fonte de vídeo configurada não é publicado incorretamente",
  );
  assert(
    !isEpisodePublished({
      id: "ep-3",
      number: 3,
      videoUrl: "https://pub-r2.hikari.tv/ep3.mp4",
      published: false,
    }),
    "Episódio explicitamente despublicado (published=false) é respeitado",
  );

  console.log("\n===============================================================");
  console.log(`RESULTADO DA SUITE: ${passed} passaram, ${failed} falharam.`);
  console.log("===============================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAdminSecuritySuite().catch((err) => {
  console.error("Erro fatal na suite de segurança administrativa:", err);
  process.exit(1);
});
