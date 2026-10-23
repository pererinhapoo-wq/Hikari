import { cleanEpisodeDisplay } from "../src/lib/published-episodes.ts";

const tests = [
  { num: 1, title: "Episódio 1", anime: "The Apothecary Diaries", expected: "Episódio 1" },
  { num: 1, title: "Episódio 1 - Episódio 1", anime: "The Apothecary Diaries", expected: "Episódio 1" },
  { num: 1, title: "The Apothecary Diaries Episódio 1", anime: "The Apothecary Diaries", expected: "Episódio 1" },
  { num: 1, title: "The Apothecary Diaries - 1", anime: "The Apothecary Diaries", expected: "Episódio 1" },
  { num: 1, title: "The Apothecary Diaries - Episode 1 - Curse of the Powder", anime: "The Apothecary Diaries", expected: "Episódio 1 — Curse of the Powder" },
  { num: 1, title: "Curse of the Powder", anime: "The Apothecary Diaries", expected: "Episódio 1 — Curse of the Powder" },
  { num: 1, title: "1. A Maldição", anime: "The Apothecary Diaries", expected: "Episódio 1 — A Maldição" },
  { num: 1, title: "01. A Maldição", anime: "The Apothecary Diaries", expected: "Episódio 1 — A Maldição" },
  { num: 1, title: "Episódio 1 - A Maldição", anime: "The Apothecary Diaries", expected: "Episódio 1 — A Maldição" },
  { num: 1, title: "Episode 1: The Curse", anime: "The Apothecary Diaries", expected: "Episódio 1 — The Curse" },
  { num: 25, title: "Attack on Titan - Episode 25 - The Wall", anime: "Attack on Titan", expected: "Episódio 25 — The Wall" },
  { num: 1, title: "The Apothecary Diaries", anime: "The Apothecary Diaries", expected: "Episódio 1" },
  { num: 1, title: "Kusuriya no Hitorigoto 1", anime: ["Kusuriya no Hitorigoto", "The Apothecary Diaries"], expected: "Episódio 1" },
  { num: 1, title: "Ep. 01 - O Começo", anime: "The Apothecary Diaries", expected: "Episódio 1 — O Começo" },
  { num: 1, title: "Episódio 01", anime: "The Apothecary Diaries", expected: "Episódio 1" },
  { num: 2, title: "Episode 2 That Day", anime: "Attack on Titan", expected: "Episódio 2 — That Day" },
  { num: 1, title: "1", anime: "The Apothecary Diaries", expected: "Episódio 1" },
  { num: 1, title: "The Apothecary Diaries (1)", anime: "The Apothecary Diaries", expected: "Episódio 1" },
  { num: 1, title: "Episode 1 - The Curse (The Apothecary Diaries)", anime: "The Apothecary Diaries", expected: "Episódio 1 — The Curse" },
  { num: 1, title: "Episódio 1: Episódio 1 - O Começo", anime: "The Apothecary Diaries", expected: "Episódio 1 — O Começo" },
  { num: 1, title: "Solo Leveling 01 - Eu Estou Acostumado", anime: "Solo Leveling", expected: "Episódio 1 — Eu Estou Acostumado" },
  { num: 26, title: "Demon Slayer: Kimetsu no Yaiba - Episode 26 - New Mission", anime: ["Demon Slayer: Kimetsu no Yaiba", "Kimetsu no Yaiba"], expected: "Episódio 26 — New Mission" },
  { num: 1, title: "[01]", anime: "The Apothecary Diaries", expected: "Episódio 1" },
  { num: 1, title: "The Apothecary Diaries [1]", anime: "The Apothecary Diaries", expected: "Episódio 1" },
  { num: 1, title: "Episódio 1 - Ep 1", anime: "The Apothecary Diaries", expected: "Episódio 1" },
];

let failed = 0;
for (const test of tests) {
  const result = cleanEpisodeDisplay(test.num, test.title, test.anime);
  if (result !== test.expected) {
    console.error(`FAILED: "${test.title}" => "${result}" (expected "${test.expected}")`);
    failed++;
  } else {
    console.log(`PASS: "${test.title}" => "${result}"`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} tests failed!`);
  process.exit(1);
} else {
  console.log(`\nAll ${tests.length} tests passed successfully!`);
}
