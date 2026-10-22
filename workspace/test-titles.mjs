function cleanEpisodeDisplay(
  episodeNumber,
  rawTitle,
  animeTitleOrTitles,
) {
  if (!rawTitle) {
    return `Episódio ${episodeNumber}`;
  }

  let title = rawTitle.trim();

  const names = new Set();
  const inputTitles = Array.isArray(animeTitleOrTitles)
    ? animeTitleOrTitles
    : animeTitleOrTitles
      ? [animeTitleOrTitles]
      : [];

  for (const a of inputTitles) {
    if (!a || typeof a !== "string") continue;
    const clean = a.trim();
    if (clean) {
      names.add(clean);
      if (clean.includes(":")) names.add(clean.split(":")[0].trim());
      if (clean.includes(" - ")) names.add(clean.split(" - ")[0].trim());
      if (clean.includes(" (")) names.add(clean.split(" (")[0].trim());
      if (clean.includes(" [")) names.add(clean.split(" [")[0].trim());
    }
  }

  for (const name of Array.from(names).sort((a, b) => b.length - a.length)) {
    if (!name || name.length < 2) continue;
    if (title.toLowerCase() === name.toLowerCase()) {
      return `Episódio ${episodeNumber}`;
    }
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    title = title.replace(new RegExp(`^${escaped}\\s*[-–—:]*\\s*`, "i"), "").trim();
    title = title.replace(new RegExp(`\\s*[-–—:]*\\s*${escaped}$`, "i"), "").trim();
    title = title.replace(new RegExp(`[\\(\\[]${escaped}[\\)\\]]`, "i"), "").trim();
  }

  title = title.replace(/^(?:season|temporada|s|t)\s*\d+\s*[-–—:xX/|\s]*/i, "").trim();

  const epTokenRegex = new RegExp(
    `^(?:(?:epis[oó]dio|episode|ep\\.?|cap[ií]tulo|e)\\s*0*${episodeNumber}|#\\s*0*${episodeNumber}|\\b0*${episodeNumber}\\b)\\s*[-–—:xX/|\\s.]*`,
    "i",
  );
  let prev = "";
  while (title && prev !== title && epTokenRegex.test(title)) {
    prev = title;
    title = title.replace(epTokenRegex, "").trim();
  }

  const genericEpTokenRegex = /^(?:epis[oó]dio|episode|ep\.?|cap[ií]tulo)\s*\d*\s*[-–—:xX/|\s.]*/i;
  prev = "";
  while (title && prev !== title && genericEpTokenRegex.test(title)) {
    prev = title;
    title = title.replace(genericEpTokenRegex, "").trim();
  }

  title = title.replace(/[-–—:]\s*(?:epis[oó]dio|episode|ep\.?)\s*0*\d*$/i, "").trim();
  title = title.replace(/^[-–—:/|.,\s"'\\]+/, "").replace(/[-–—:/|.,\s"'\\]+$/, "").trim();

  if (
    !title ||
    title === String(episodeNumber) ||
    title === `0${episodeNumber}` ||
    new RegExp(`^(?:epis[oó]dio|episode|ep\\.?|cap[ií]tulo|e)\\s*0*${episodeNumber}$`, "i").test(title) ||
    new RegExp(`^(?:epis[oó]dio|episode|ep\\.?|cap[ií]tulo|e)$`, "i").test(title)
  ) {
    return `Episódio ${episodeNumber}`;
  }

  return `Episódio ${episodeNumber} — ${title}`;
}

const tests = [
  [1, "Episódio 1", "The Apothecary Diaries"],
  [1, "Episódio 1 - Episódio 1", "The Apothecary Diaries"],
  [1, "The Apothecary Diaries Episódio 1", "The Apothecary Diaries"],
  [1, "The Apothecary Diaries - 1", "The Apothecary Diaries"],
  [1, "The Apothecary Diaries - Episode 1 - Curse of the Powder", "The Apothecary Diaries"],
  [1, "Curse of the Powder", "The Apothecary Diaries"],
  [1, "1. A Maldição", "The Apothecary Diaries"],
  [1, "01. A Maldição", "The Apothecary Diaries"],
  [1, "Episódio 1 - A Maldição", "The Apothecary Diaries"],
  [1, "Episode 1: The Curse", "The Apothecary Diaries"],
  [25, "Attack on Titan - Episode 25 - The Wall", "Attack on Titan"],
  [1, "The Apothecary Diaries", "The Apothecary Diaries"],
  [1, "Kusuriya no Hitorigoto 1", ["Kusuriya no Hitorigoto", "The Apothecary Diaries"]],
  [1, "Ep. 01 - O Começo", "The Apothecary Diaries"],
  [1, "Episódio 01", "The Apothecary Diaries"],
  [2, "Episode 2 That Day", "Attack on Titan"],
  [1, "1", "The Apothecary Diaries"],
  [1, "The Apothecary Diaries (1)", "The Apothecary Diaries"],
  [1, "Episode 1 - The Curse (The Apothecary Diaries)", "The Apothecary Diaries"],
  [1, "Episódio 1: Episódio 1 - O Começo", "The Apothecary Diaries"],
];

for (const [num, title, anime] of tests) {
  console.log(`"${title}" => "${cleanEpisodeDisplay(num, title, anime)}"`);
}
