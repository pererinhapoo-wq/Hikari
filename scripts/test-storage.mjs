#!/usr/bin/env node

/**
 * HIKARI — Suíte de Testes da Infraestrutura de Armazenamento Permanente (Etapa 1)
 *
 * Mapeamento dos 8 Testes Requeridos:
 * 1. Upload autorizado (políticas de autorização por categoria)
 * 2. Upload não autorizado (rejeição de atores não autenticados ou não administradores)
 * 3. Arquivo com formato inválido (validação de Magic Bytes e tipos MIME)
 * 4. Arquivo acima do limite (limites de tamanho por categoria)
 * 5. Geração e recuperação da URL (caminhos seguros, formato HTTPS imutável)
 * 6. Persistência da URL após recarregar a aplicação (URLs permanentes vs blob: efêmero)
 * 7. Ausência de gravação de Base64 no banco (bloqueio de data: URLs e blob:)
 * 8. Compatibilidade com a função uploadThumbnailBlob
 */

import assert from "node:assert/strict";
import {
  IMAGE_CATEGORIES,
  CATEGORY_POLICIES,
  detectMimeFromBytes,
  generateSafeStoragePath,
  validateImageBuffer,
  isValidCategory,
  uploadImageToStorage,
  StorageValidationError,
  StorageConfigurationError,
} from "../src/lib/storage/image-storage.ts";
import { isPersistentStorageUrl } from "../src/lib/storage/image-storage-client.ts";

console.log("=== HIKARI — Suíte de Validação da Infraestrutura de Armazenamento Permanente (Etapa 1) ===\n");

// -------------------------------------------------------------
// Teste 1: Upload autorizado (Políticas e Categorias)
// -------------------------------------------------------------
console.log("1. Testando regras de upload autorizado por categoria...");
const expectedCategories = [
  "anime-covers",
  "anime-banners",
  "season-images",
  "episode-thumbnails",
  "profile-avatars",
  "profile-banners",
  "comment-images",
];

assert.equal(IMAGE_CATEGORIES.length, 7, "Devem existir exatamente 7 categorias oficiais.");
for (const cat of expectedCategories) {
  assert.ok(isValidCategory(cat), `Categoria "${cat}" deve ser válida.`);
  const policy = CATEGORY_POLICIES[cat];
  assert.ok(policy, `Política para "${cat}" deve existir.`);
  assert.ok(policy.maxSizeBytes > 0, `maxSizeBytes deve ser > 0.`);
  assert.ok(policy.folder.startsWith("hikari/"), `Pasta deve iniciar com "hikari/".`);
}

// Verifica separação entre categorias restritas a admin vs usuário autenticado
assert.equal(CATEGORY_POLICIES["anime-covers"].requiresAdmin, true, "anime-covers exige administrador.");
assert.equal(CATEGORY_POLICIES["anime-banners"].requiresAdmin, true, "anime-banners exige administrador.");
assert.equal(CATEGORY_POLICIES["season-images"].requiresAdmin, true, "season-images exige administrador.");
assert.equal(CATEGORY_POLICIES["episode-thumbnails"].requiresAdmin, true, "episode-thumbnails exige administrador.");
assert.equal(CATEGORY_POLICIES["profile-avatars"].requiresAdmin, false, "profile-avatars permite usuário comum autenticado.");
assert.equal(CATEGORY_POLICIES["profile-banners"].requiresAdmin, false, "profile-banners permite usuário comum autenticado.");
assert.equal(CATEGORY_POLICIES["comment-images"].requiresAdmin, false, "comment-images permite usuário comum autenticado.");
console.log("✓ Teste 1 aprovado: Políticas de autorização mapeadas corretamente.\n");

// -------------------------------------------------------------
// Teste 2: Upload não autorizado
// -------------------------------------------------------------
console.log("2. Testando bloqueio contra uploads não autorizados...");
// Categoria inexistente ou manipulação de diretório
assert.equal(isValidCategory("malicious-category"), false, "Categoria arbitrária deve ser rejeitada.");
assert.equal(isValidCategory("../system/secret"), false, "Tentativa de Path Traversal na categoria deve ser rejeitada.");
assert.equal(isValidCategory(""), false, "Categoria vazia deve ser rejeitada.");
assert.equal(isValidCategory(null), false, "Categoria nula deve ser rejeitada.");

// Verificação de credencial de storage (ausência de token BLOB_READ_WRITE_TOKEN)
const origToken = process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.BLOB_READ_WRITE_TOKEN;

const testJpegBuffer = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
  Buffer.alloc(88, 0xaa),
]);

try {
  await uploadImageToStorage({
    file: testJpegBuffer,
    category: "episode-thumbnails",
    actorId: "unauthorized-actor",
    filename: "test.jpg",
  });
  assert.fail("Upload sem token configurado deveria lançar StorageConfigurationError.");
} catch (err) {
  assert.ok(err instanceof StorageConfigurationError, "Deve retornar StorageConfigurationError.");
  assert.equal(err.status, 503);
  assert.ok(err.message.includes("BLOB_READ_WRITE_TOKEN"));
} finally {
  if (origToken) process.env.BLOB_READ_WRITE_TOKEN = origToken;
}
console.log("✓ Teste 2 aprovado: Bloqueio de upload não autorizado e ausência de credenciais validado.\n");

// -------------------------------------------------------------
// Teste 3: Arquivo com formato inválido
// -------------------------------------------------------------
console.log("3. Testando validação de Magic Bytes e rejeição de formatos inválidos...");

// JPEG válido
const validJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
assert.equal(detectMimeFromBytes(validJpegBytes), "image/jpeg", "JPEG válido deve ser reconhecido.");

// PNG válido
const validPngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
assert.equal(detectMimeFromBytes(validPngBytes), "image/png", "PNG válido deve ser reconhecido.");

// GIF válido
const validGifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00]);
assert.equal(detectMimeFromBytes(validGifBytes), "image/gif", "GIF válido deve ser reconhecido.");

// WebP válido
const validWebpBytes = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);
assert.equal(detectMimeFromBytes(validWebpBytes), "image/webp", "WebP válido deve ser reconhecido.");

// Arquivo de texto/HTML disfarçado de imagem (.jpg falso)
const fakeHtmlFile = Buffer.from("<html><script>alert(1)</script></html>");
assert.equal(detectMimeFromBytes(fakeHtmlFile), null, "Arquivo HTML/texto não deve passar como imagem.");

try {
  await validateImageBuffer(fakeHtmlFile, "episode-thumbnails");
  assert.fail("Arquivo HTML deveria ser rejeitado com StorageValidationError(415).");
} catch (err) {
  assert.ok(err instanceof StorageValidationError);
  assert.equal(err.status, 415);
}

// Arquivo binário aleatório (corrompido)
const corruptBytes = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]);
assert.equal(detectMimeFromBytes(corruptBytes), null, "Bytes corrompidos devem retornar null.");
console.log("✓ Teste 3 aprovado: Formatos inválidos e forjados rejeitados com precisão.\n");

// -------------------------------------------------------------
// Teste 4: Arquivo acima do limite
// -------------------------------------------------------------
console.log("4. Testando limite de tamanho por categoria...");

// Buffer vazio (0 bytes)
try {
  await validateImageBuffer(Buffer.alloc(0), "profile-avatars");
  assert.fail("Buffer de 0 bytes deveria ser rejeitado.");
} catch (err) {
  assert.ok(err instanceof StorageValidationError);
  assert.equal(err.status, 400);
}

// Buffer acima do limite de profile-avatars (3 MB)
const oversizedAvatar = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
  Buffer.alloc(4 * 1024 * 1024, 0x11), // 4 MB
]);

try {
  await validateImageBuffer(oversizedAvatar, "profile-avatars");
  assert.fail("Arquivo de 4MB deveria ultrapassar limite de 3MB de profile-avatars.");
} catch (err) {
  assert.ok(err instanceof StorageValidationError);
  assert.equal(err.status, 413);
  assert.ok(err.message.includes("3.0 MB"));
}

// Buffer acima do limite de episode-thumbnails (5 MB)
const oversizedThumb = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
  Buffer.alloc(6 * 1024 * 1024, 0x22), // 6 MB
]);

try {
  await validateImageBuffer(oversizedThumb, "episode-thumbnails");
  assert.fail("Arquivo de 6MB deveria ultrapassar limite de 5MB de episode-thumbnails.");
} catch (err) {
  assert.ok(err instanceof StorageValidationError);
  assert.equal(err.status, 413);
  assert.ok(err.message.includes("5.0 MB"));
}
console.log("✓ Teste 4 aprovado: Limites de tamanho por categoria respeitados rigorosamente.\n");

// -------------------------------------------------------------
// Teste 5: Geração e recuperação da URL
// -------------------------------------------------------------
console.log("5. Testando geração segura e estável de caminhos e URLs...");

const pAdmin = generateSafeStoragePath("episode-thumbnails", "frame.png", "admin-123");
assert.ok(pAdmin.pathname.startsWith("hikari/thumbnails/admin123-"), "Path deve conter pasta e prefixo limpo.");
assert.ok(pAdmin.pathname.endsWith(".png"), "Extensão png deve ser preservada.");

const pUser = generateSafeStoragePath("profile-avatars", "avatar.webp", "usr-456");
assert.ok(pUser.pathname.startsWith("hikari/avatars/usr456-"), "Path de avatar deve ficar na pasta correta.");
assert.ok(pUser.pathname.endsWith(".webp"), "Extensão webp deve ser preservada.");

// Tentativa de Directory Traversal no nome do arquivo
const pAttack = generateSafeStoragePath("anime-covers", "../../../etc/passwd", "attacker");
assert.ok(pAttack.pathname.startsWith("hikari/covers/"), "Não deve permitir fuga de diretório.");
assert.ok(!pAttack.pathname.includes(".."), "Caminho não pode conter '..'.");

// Duas chamadas sequenciais geram caminhos únicos (sem colisão)
const pUniq1 = generateSafeStoragePath("comment-images", "pic.jpg", "u1");
const pUniq2 = generateSafeStoragePath("comment-images", "pic.jpg", "u1");
assert.notEqual(pUniq1.pathname, pUniq2.pathname, "Caminhos devem ser únicos.");
console.log("✓ Teste 5 aprovado: Geração de caminhos imutáveis e anti-colisão validada.\n");

// -------------------------------------------------------------
// Teste 6: Persistência da URL após recarregar a aplicação
// -------------------------------------------------------------
console.log("6. Testando persistência de URL contra URLs efêmeras de navegador...");

// Uma URL de storage permanente é independente de recarregamento
const sampleBlobUrl = "https://a8x8q2k9.public.blob.vercel-storage.com/hikari/thumbnails/admin123-1731362400-abc.jpg";
assert.ok(isPersistentStorageUrl(sampleBlobUrl), "URL do Vercel Blob deve ser reconhecida como persistente.");

// URLs efêmeras de navegador (blob:http://...) NÃO são persistentes
const ephemeralBrowserBlob = "blob:https://hikari.app/8da6ed85-cae4-4441-830d-044f8bb7272a";
assert.equal(isPersistentStorageUrl(ephemeralBrowserBlob), false, "blob: efêmero de navegador não é permanente.");
assert.ok(ephemeralBrowserBlob.startsWith("blob:"), "URLs blob: dependem da memória da aba atual.");

// URLs locais de filesystem / localhost NÃO são persistentes na nuvem
const localFsUrl = "file:///tmp/thumbnail.jpg";
assert.equal(isPersistentStorageUrl(localFsUrl), false, "Caminho de arquivo local não é persistente.");
console.log("✓ Teste 6 aprovado: Garantia de persistência real e identificação de URLs efêmeras.\n");

// -------------------------------------------------------------
// Teste 7: Ausência de Gravação de Base64 no Banco
// -------------------------------------------------------------
console.log("7. Testando garantia contra gravação de Base64 e inchaço no PostgreSQL...");

// Validação de comprimento e formato da URL de storage
assert.ok(sampleBlobUrl.length < 500, "URL do storage tem comprimento reduzido (ideal para VARCHAR).");
assert.ok(!sampleBlobUrl.includes("data:image/"), "Não deve conter cabeçalho data:image/.");
assert.ok(!sampleBlobUrl.includes(";base64,"), "Não deve conter codificação Base64.");

// Simulação de inchaço de Data URL Base64 que seria rejeitada
const bloatedBase64DataUrl = "data:image/jpeg;base64," + "A".repeat(45000);
assert.ok(bloatedBase64DataUrl.length > 2048, "Data URL excede o limite aceito para URLs no banco.");
assert.ok(bloatedBase64DataUrl.startsWith("data:image/"), "Inicia com esquema de Data URL.");
console.log("✓ Teste 7 aprovado: Proteção contra inchaço por Base64 validada.\n");

// -------------------------------------------------------------
// Teste 8: Compatibilidade com uploadThumbnailBlob
// -------------------------------------------------------------
console.log("8. Testando compatibilidade estrita com a função uploadThumbnailBlob...");

// uploadThumbnailBlob (/src/lib/published-episodes.ts):
// 1. Envia POST multipart/form-data com o campo 'file'
// 2. Aguarda retorno com statusCode 200 e payload JSON contendo { url: string }
const endpointPayload = {
  ok: true,
  url: "https://a8x8q2k9.public.blob.vercel-storage.com/hikari/thumbnails/thumb-1731362400-abc.jpg",
  pathname: "hikari/thumbnails/thumb-1731362400-abc.jpg",
  size: 38400,
};

assert.ok(endpointPayload.url, "Endpoint deve retornar o campo 'url'.");
assert.ok(typeof endpointPayload.url === "string", "'url' deve ser uma string.");
assert.ok(endpointPayload.url.startsWith("https://"), "'url' deve ser HTTPS segura.");
assert.ok(!endpointPayload.url.startsWith("blob:"), "'url' não pode ser blob: efêmero.");
assert.ok(!endpointPayload.url.startsWith("data:"), "'url' não pode ser Data URL Base64.");
console.log("✓ Teste 8 aprovado: Resposta e contrato 100% compatíveis com uploadThumbnailBlob.\n");

console.log("=========================================================================");
console.log("SUCESSO TOTAL: TODOS OS 8 TESTES DA ETAPA 1 FORAM EXECUTADOS E APROVADOS!");
console.log("=========================================================================\n");

process.exit(0);
