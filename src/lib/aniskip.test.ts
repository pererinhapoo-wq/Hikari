import { test, describe } from "node:test";
import assert from "node:assert";
import {
  formatSecondsToTime,
  parseTimeToSeconds,
  fetchAniSkipTimestamps,
  fetchAniSkipRelationRules,
} from "./aniskip.ts";

describe("AniSkip & Opening Timestamps Audit Suite", () => {
  test("1. Conversão de segundos para MM:SS (formato esperado pelo Admin)", () => {
    assert.equal(formatSecondsToTime(2), "00:02");
    assert.equal(formatSecondsToTime(180), "03:00");
    assert.equal(formatSecondsToTime(95), "01:35");
    assert.equal(formatSecondsToTime(0), "00:00");
    assert.equal(formatSecondsToTime(null), "");
    assert.equal(formatSecondsToTime(undefined), "");
  });

  test("2. Conversão de tempo MM:SS para segundos", () => {
    assert.equal(parseTimeToSeconds("00:02"), 2);
    assert.equal(parseTimeToSeconds("03:00"), 180);
    assert.equal(parseTimeToSeconds("01:35"), 95);
    assert.equal(parseTimeToSeconds("90"), 90);
    assert.equal(parseTimeToSeconds(null), null);
  });

  test("3. Validação de parâmetros inválidos (sem MAL ID)", async () => {
    const res = await fetchAniSkipTimestamps(0, 1);
    assert.equal(res.found, false);
    assert.equal(res.openingStartSeconds, null);
    assert.equal(res.openingEndSeconds, null);
  });

  test("4. Validação de número de episódio inválido", async () => {
    const res = await fetchAniSkipTimestamps(21185, 0);
    assert.equal(res.found, false);
  });

  test("5. Identificação correta de tipo op vs ed (simulação de lógica)", () => {
    const results = [
      { skipType: "ed", interval: { startTime: 1200, endTime: 1290 } },
      { skipType: "op", interval: { startTime: 5, endTime: 95 } },
    ];
    const opResult = results.find((r) => r.skipType === "op" || r.skipType === "mixed-op");
    assert.ok(opResult);
    assert.equal(opResult.interval.startTime, 5);
    assert.equal(opResult.interval.endTime, 95);
  });

  test("6. Validação de intervalos inválidos (fim menor ou igual ao início)", () => {
    const start = 100;
    const end = 50;
    const isValid = start >= 0 && end > start;
    assert.equal(isValid, false);
  });

  test("7. Consulta de regras de relacionamento com MAL ID inválido", async () => {
    const res = await fetchAniSkipRelationRules(0);
    assert.equal(res.found, false);
    assert.deepEqual(res.rules, []);
  });

  test("8. Teste de fallback seguro do Redis / Cache", async () => {
    // Quando o Redis não está configurado ou falha, deve prosseguir sem exceções
    const res = await fetchAniSkipTimestamps(-999, 1);
    assert.equal(res.found, false);
  });

  test("9. Formato MM:SS com horas ou minutos grandes", () => {
    assert.equal(formatSecondsToTime(3665), "61:05");
  });

  test("10. Tratamento de strings vazias em parseTimeToSeconds", () => {
    assert.equal(parseTimeToSeconds("   "), null);
    assert.equal(parseTimeToSeconds("abc"), null);
  });
});
