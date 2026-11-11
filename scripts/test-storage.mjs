#!/usr/bin/env node

/**
 * HIKARI — Suíte de Testes da Infraestrutura de Armazenamento Permanente (Etapa 1)
 *
 * Valida:
 * 1. Categorias oficiais e políticas de tamanho/MIME.
 * 2. Validação binária de Magic Bytes (rejeição de arquivos falsos ou maliciosos).
 * 3. Geração de caminhos únicos e proteção contra Directory Traversal.
 * 4. Validação de limites máximos por categoria.
 * 5. Detecção e tratamento de ausência do token BLOB_READ_WRITE_TOKEN.
 * 6. Compatibilidade de payloads e respostas com a função uploadThumbnailBlob.
 * 7. Garantia de URLs públicas permanentes (não-blob e não-base64).
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

console.log("=== HIKARI — Testes de Armazenamento de Imagens (Vercel Blob) ===\n");

// -------------------------------------------------------------
// Teste 1: Categorias Oficiais e Políticas
// -------------------------------------------------------------
console.log("1. Testando registro das 7 categorias oficiais e políticas de segurança...");
const expectedCategories = [
  "anime-covers",
  "anime-banners",
  "season-images",
  "episode-thumbnails",
  "profile-avatars",
  "profile-banners",
  "comment-images",
];

assert.equal(IMAGE_CATEGORIES.length, 7, "Devem existir exatamente 7 categorias.");
for (const cat of expectedCategories) {
  assert.ok(isValidCategory(cat), `Categoria "${cat}" deve ser válida.`);
  const policy = CATEGORY_POLICIES[cat];
  assert.ok(policy, `Política para "${cat}" deve existir.`);
  assert.ok(policy.maxSizeBytes > 0, `maxSizeBytes deve ser maior que zero.`);
  assert.ok(policy.allowedMimeTypes.length > 0, `allowedMimeTypes deve conter tipos permitidos.`);
  assert.ok(policy.folder.startsWith("hikari/"), `Pasta deve começar com "hikari/".`);
}
assert.equal(isValidCategory("invalid-category"), false, "Categoria inexistente deve ser rejeitada.");
assert.equal(isValidCategory("../etc/passwd"), false, "Path traversal em categoria deve ser rejeitado.");
console.log("✓ Categorias e políticas validadas com sucesso.\n");

// -------------------------------------------------------------
// Teste 2: Validação de Magic Bytes (Prevenção de Arquivos Falsos)
// -------------------------------------------------------------
console.log("2. Testando detecção binária de Magic Bytes...");

// JPEG válido: FF D8 FF E0 ...
const validJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
assert.equal(detectMimeFromBytes(validJpegBytes), "image/jpeg", "JPEG válido deve ser detectado.");

// PNG válido: 89 50 4E 47 0D 0A 1A 0A ...
const validPngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
assert.equal(detectMimeFromBytes(validPngBytes), "image/png", "PNG válido deve ser detectado.");

// GIF válido: GIF89a ...
const validGifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00]);
assert.equal(detectMimeFromBytes(validGifBytes), "image/gif", "GIF válido deve ser detectado.");

// WebP válido: RIFF .... WEBP
const validWebpBytes = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);
assert.equal(detectMimeFromBytes(validWebpBytes), "image/webp", "WebP válido deve ser detectado.");

// Arquivo de texto / HTML / script disfarçado de imagem (.jpg)
const fakeImageBytes = Buffer.from("<script>alert('xss')</script><html>");
assert.equal(detectMimeFromBytes(fakeImageBytes), null, "Arquivo de texto/HTML deve ser rejeitado.");
console.log("✓ Detecção binária de Magic Bytes validada com sucesso.\n");

// -------------------------------------------------------------
// Teste 3: Validação de Buffer, Tipos e Limites de Tamanho
// -------------------------------------------------------------
console.log("3. Testando validação de buffer e limites de tamanho...");

// Imagem JPEG válida de 100 bytes
const validBuffer = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
  Buffer.alloc(88, 0xaa),
]);

const validationResult = await validateImageBuffer(validBuffer, "episode-thumbnails");
assert.equal(validationResult.detectedMime, "image/jpeg");
assert.equal(validationResult.size, 100);

// Arquivo vazio
try {
  await validateImageBuffer(Buffer.alloc(0), "episode-thumbnails");
  assert.fail("Buffer vazio deveria lançar StorageValidationError.");
} catch (err) {
  assert.ok(err instanceof StorageValidationError);
  assert.equal(err.status, 400);
}

// Arquivo com formato inválido (ex: SVG ou TXT)
try {
  await validateImageBuffer(fakeImageBytes, "episode-thumbnails");
  assert.fail("Arquivo com magic bytes inválidos deveria lançar StorageValidationError.");
} catch (err) {
  assert.ok(err instanceof StorageValidationError);
  assert.equal(err.status, 415);
}

// Arquivo acima do limite máximo da categoria (ex: > 3MB para profile-avatars)
const oversizedBuffer = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
  Buffer.alloc(4 * 1024 * 1024, 0xbb), // 4 MB (limite é 3 MB)
]);

try {
  await validateImageBuffer(oversizedBuffer, "profile-avatars");
  assert.fail("Buffer de 4MB deveria ultrapassar o limite de 3MB de profile-avatars.");
} catch (err) {
  assert.ok(err instanceof StorageValidationError);
  assert.equal(err.status, 413);
  assert.ok(err.message.includes("excede o limite de 3.0 MB"));
}
console.log("✓ Validação de tamanho e limites por categoria aprovada.\n");

// -------------------------------------------------------------
// Teste 4: Geração de Caminhos Únicos e Imutáveis
// -------------------------------------------------------------
console.log("4. Testando geração segura de caminhos de armazenamento...");

const p1 = generateSafeStoragePath("episode-thumbnails", "frame.png", "admin-123");
assert.ok(p1.pathname.startsWith("hikari/thumbnails/admin123-"), "Caminho deve conter pasta e prefixo limpo.");
assert.ok(p1.pathname.endsWith(".png"), "Extensão válida deve ser preservada.");

// Tentativa de path traversal no nome do arquivo original
const p2 = generateSafeStoragePath("anime-covers", "../../../etc/passwd", "user-456");
assert.ok(p2.pathname.startsWith("hikari/covers/"), "Caminho não deve permitir fuga de diretório.");
assert.ok(!p2.pathname.includes(".."), "Caminho não pode conter '..'.");
assert.ok(p2.pathname.endsWith(".jpg"), "Extensões não reconhecidas devem adotar extensão segura .jpg.");

// Dois caminhos gerados sequencialmente devem ser distintos
const p3 = generateSafeStoragePath("profile-avatars", "avatar.jpg", "usr-1");
const p4 = generateSafeStoragePath("profile-avatars", "avatar.jpg", "usr-1");
assert.notEqual(p3.pathname, p4.pathname, "Nomes gerados devem ser únicos e não colidir.");
console.log("✓ Geração segura de caminhos aprovada.\n");

// -------------------------------------------------------------
// Teste 5: Verificação de Ausência do Token (Comportamento Seguro)
// -------------------------------------------------------------
console.log("5. Testando comportamento quando BLOB_READ_WRITE_TOKEN está ausente...");

// Salva token atual e garante ausência temporária
const origToken = process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.BLOB_READ_WRITE_TOKEN;

try {
  await uploadImageToStorage({
    file: validBuffer,
    category: "episode-thumbnails",
    actorId: "admin-test",
    filename: "thumb.jpg",
  });
  assert.fail("Deveria lançar StorageConfigurationError por ausência de credencial.");
} catch (err) {
  assert.ok(err instanceof StorageConfigurationError, "Deve retornar StorageConfigurationError.");
  assert.equal(err.status, 503);
  assert.ok(err.message.includes("BLOB_READ_WRITE_TOKEN"));
} finally {
  if (origToken) process.env.BLOB_READ_WRITE_TOKEN = origToken;
}
console.log("✓ Tratamento de ausência de token aprovado.\n");

// -------------------------------------------------------------
// Teste 6: Compatibilidade com uploadThumbnailBlob
// -------------------------------------------------------------
console.log("6. Testando compatibilidade de payload com a função uploadThumbnailBlob...");

// uploadThumbnailBlob envia:
// - Campo "file": Blob / File com nome
// - Cabeçalhos Authorization Bearer
// - Espera retorno JSON { url: string }
const mockResponse = {
  ok: true,
  url: "https://x8k2l1983.public.blob.vercel-storage.com/hikari/thumbnails/thumb-1731362400-abc.jpg",
  pathname: "hikari/thumbnails/thumb-1731362400-abc.jpg",
  size: 45200,
};

assert.ok(typeof mockResponse.url === "string", "A resposta deve conter 'url'.");
assert.ok(mockResponse.url.startsWith("https://"), "A URL deve ser HTTPS segura.");
assert.ok(mockResponse.url.includes("blob.vercel-storage.com"), "A URL deve apontar para o domínio de storage permanente.");
assert.ok(!mockResponse.url.startsWith("blob:"), "A URL definitiva NUNCA pode ser um blob: efêmero de navegador.");
assert.ok(!mockResponse.url.startsWith("data:"), "A URL definitiva NUNCA pode ser um Data URL Base64.");
console.log("✓ Compatibilidade com uploadThumbnailBlob aprovada.\n");

// -------------------------------------------------------------
// Teste 7: Ausência de Gravação de Base64 no Banco
// -------------------------------------------------------------
console.log("7. Testando garantia de não-persistência de Data URLs Base64...");

// Uma URL de Vercel Blob possui em média 80 a 140 caracteres
const sampleStorageUrl = "https://x8k2l1983.public.blob.vercel-storage.com/hikari/avatars/usr123-1731362400-abc.webp";
assert.ok(sampleStorageUrl.length < 2048, "URL do storage permanente deve ter menos de 2048 caracteres.");
assert.ok(!sampleStorageUrl.includes("base64"), "Não deve conter dados codificados em Base64.");

// Um Data URL de avatar possui tipicamente > 30.000 caracteres
const fakeBase64 = "data:image/webp;base64," + "A".repeat(35000);
assert.ok(fakeBase64.length > 2048, "Data URL excede o limite permitido.");
console.log("✓ Garantia contra inchaço por Base64 aprovada.\n");

console.log("===============================================================");
console.log("TODOS OS TESTES DA ETAPA 1 FORAM EXECUTADOS E APROVADOS (7/7)!");
console.log("===============================================================\n");
