import { getSql } from "../src/lib/db.ts";

async function main() {
  console.log("Seeding favorites for dev-user...");
  const sql = await getSql();

  // 1. Ensure user dev-user exists
  await sql.query(`
    INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
    VALUES ('dev-user', 'Dev User', 'dev@example.com', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO NOTHING;
  `);

  // 2. Insert catalog animes
  const animes = [
    { id: "21", title: "One Piece", year: 1999, format: "TV", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-YCDoj1EkAxFn.jpg" },
    { id: "16498", title: "Attack on Titan", year: 2013, format: "TV", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-m5ZMNScqnDF1.jpg" },
    { id: "154587", title: "Frieren: Beyond Journey's End", year: 2023, format: "TV", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1HJZtxV5Auh.jpg" },
    { id: "101922", title: "Demon Slayer: Kimetsu no Yaiba", year: 2019, format: "TV", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-PEn1CTDYSoUp.jpg" },
    { id: "11061", title: "Hunter x Hunter (2011)", year: 2011, format: "TV", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx11061-sIpBtpnv99iP.jpg" },
    { id: "5114", title: "Fullmetal Alchemist: Brotherhood", year: 2009, format: "TV", cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5114-KJTQ91rK59an.jpg" },
  ];

  for (const a of animes) {
    await sql.query(`
      INSERT INTO "catalog_anime" ("id", "title", "year", "format", "cover", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "cover" = EXCLUDED."cover";
    `, [a.id, a.title, a.year, a.format, a.cover]);

    await sql.query(`
      INSERT INTO "user_favorite" ("id", "userId", "targetType", "animeId", "position", "createdAt")
      VALUES ($1, 'dev-user', 'anime', $2, 0, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO NOTHING;
    `, [`fav_anime_${a.id}`, a.id]);
  }

  // 3. Insert catalog characters
  const characters = [
    { id: "char_1", name: "Monkey D. Luffy", imageUrl: "https://s4.anilist.co/file/anilistcdn/character/large/b40-X198EfcB3Q5b.png" },
    { id: "char_2", name: "Frieren", imageUrl: "https://s4.anilist.co/file/anilistcdn/character/large/b182247-uD2Z3K673F1L.jpg" },
    { id: "char_3", name: "Levi Ackerman", imageUrl: "https://s4.anilist.co/file/anilistcdn/character/large/b45627-8Yf0Qj34zP3g.jpg" },
    { id: "char_4", name: "Killua Zoldyck", imageUrl: "https://s4.anilist.co/file/anilistcdn/character/large/b27-0N28iXf3r2Hk.jpg" },
  ];

  for (const c of characters) {
    await sql.query(`
      INSERT INTO "catalog_character" ("id", "name", "imageUrl", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "imageUrl" = EXCLUDED."imageUrl";
    `, [c.id, c.name, c.imageUrl]);

    await sql.query(`
      INSERT INTO "user_favorite" ("id", "userId", "targetType", "characterId", "position", "createdAt")
      VALUES ($1, 'dev-user', 'character', $2, 0, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO NOTHING;
    `, [`fav_char_${c.id}`, c.id]);
  }

  // 4. Insert catalog studios
  const studios = [
    { id: "studio_1", name: "Toei Animation", establishedYear: 1948 },
    { id: "studio_2", name: "Madhouse", establishedYear: 1972 },
    { id: "studio_3", name: "Ufotable", establishedYear: 2000 },
    { id: "studio_4", name: "Kyoto Animation", establishedYear: 1981 },
  ];

  for (const s of studios) {
    await sql.query(`
      INSERT INTO "catalog_studio" ("id", "name", "establishedYear", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name";
    `, [s.id, s.name, s.establishedYear]);

    await sql.query(`
      INSERT INTO "user_favorite" ("id", "userId", "targetType", "studioId", "position", "createdAt")
      VALUES ($1, 'dev-user', 'studio', $2, 0, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO NOTHING;
    `, [`fav_studio_${s.id}`, s.id]);
  }

  // 5. Insert catalog dubladores & people
  const people = [
    { id: "person_1", name: "Mayumi Tanaka", biography: "Dubladora de renome (Voice Actor - Monkey D. Luffy)", imageUrl: "https://s4.anilist.co/file/anilistcdn/staff/large/n95001-K5h8c2Z19lmn.jpg" },
    { id: "person_2", name: "Atsumi Tanezaki", biography: "Dubladora premiada (Voice Actor - Frieren, Anya Forger)", imageUrl: "https://s4.anilist.co/file/anilistcdn/staff/large/n115206-mO79mK18VbN9.jpg" },
    { id: "person_3", name: "Hiroshi Kamiya", biography: "Dublador aclamado (Voice Actor - Levi, Trafalgar Law)", imageUrl: "https://s4.anilist.co/file/anilistcdn/staff/large/n95118-8s1f2y7T6aKz.jpg" },
    { id: "person_4", name: "Hayao Miyazaki", biography: "Diretor e roteirista mestre do Studio Ghibli", imageUrl: "https://s4.anilist.co/file/anilistcdn/staff/large/n96870-W3yZ99b4H1kL.jpg" },
    { id: "person_5", name: "Makoto Shinkai", biography: "Diretor de cinema e animação (Your Name, Suzume)", imageUrl: "https://s4.anilist.co/file/anilistcdn/staff/large/n96942-X7yB61j29mNo.jpg" },
  ];

  for (const p of people) {
    await sql.query(`
      INSERT INTO "catalog_person" ("id", "name", "biography", "imageUrl", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "biography" = EXCLUDED."biography", "imageUrl" = EXCLUDED."imageUrl";
    `, [p.id, p.name, p.biography, p.imageUrl]);

    await sql.query(`
      INSERT INTO "user_favorite" ("id", "userId", "targetType", "personId", "position", "createdAt")
      VALUES ($1, 'dev-user', 'person', $2, 0, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO NOTHING;
    `, [`fav_person_${p.id}`, p.id]);
  }

  console.log("Seeding completed successfully!");
}

main().catch((err) => {
  console.error("Error seeding:", err);
  process.exit(1);
});
