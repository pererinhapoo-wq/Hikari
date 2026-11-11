import { getSql } from "../src/lib/db.ts";

async function seed() {
  console.log("Iniciando seed de validação para Etapa 5...");
  const sql = await getSql();

  // 1. Garantir que dev-user e pererinha_id existem
  await sql.query(`
    INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
    VALUES 
      ('dev-user', 'Dev User', 'dev@example.com', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ('pererinha_id', 'Matheus Pererinha', 'pererinhapoo@gmail.com', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO NOTHING;
  `);

  await sql.query(`
    INSERT INTO "profile" ("userId", "nick", "displayName", "bio", "createdAt", "updatedAt")
    VALUES
      ('dev-user', 'devuser', 'Dev User', 'Perfil de desenvolvimento Hikari', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ('pererinha_id', 'pererinha', 'Matheus Pererinha', 'Criador do Hikari Animes.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE SET "nick" = EXCLUDED."nick", "displayName" = EXCLUDED."displayName";
  `);

  // 2. Inserir 28 animes no catálogo para testar paginação real de 24
  const catalogAnimes = [
    { id: "21", title: "One Piece", year: 1999, format: "TV", episodes: 1100, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-YCDoj1EkAxFn.jpg" },
    { id: "16498", title: "Attack on Titan", year: 2013, format: "TV", episodes: 25, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-m5ZMNScqnDF1.jpg" },
    { id: "154587", title: "Frieren: Beyond Journey's End", year: 2023, format: "TV", episodes: 28, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1HJZtxV5Auh.jpg" },
    { id: "101922", title: "Demon Slayer", year: 2019, format: "TV", episodes: 26, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-PEn1CTDYSoUp.jpg" },
    { id: "11061", title: "Hunter x Hunter (2011)", year: 2011, format: "TV", episodes: 148, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx11061-sIpBtpnv99iP.jpg" },
    { id: "5114", title: "Fullmetal Alchemist: Brotherhood", year: 2009, format: "TV", episodes: 64, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5114-KJTQ91rK59an.jpg" },
    { id: "1535", title: "Death Note", year: 2006, format: "TV", episodes: 37, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1535-lawCwhiv4nLT.png" },
    { id: "9253", title: "Steins;Gate", year: 2011, format: "TV", episodes: 24, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx9253-7pdcVzQSkpKq.png" },
    { id: "20", title: "Naruto", year: 2002, format: "TV", episodes: 220, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20-YJvLbgjjdFYI.jpg" },
    { id: "1735", title: "Naruto Shippuden", year: 2007, format: "TV", episodes: 500, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1735-F5nnmxGoikc6.png" },
    { id: "20605", title: "Tokyo Ghoul", year: 2014, format: "TV", episodes: 12, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20605-fHHH68EKdWye.jpg" },
    { id: "21459", title: "My Hero Academia", year: 2016, format: "TV", episodes: 13, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21459-oBMb149kwhSt.jpg" },
    { id: "113415", title: "Jujutsu Kaisen", year: 2020, format: "TV", episodes: 24, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-bbBWj4pEFseh.jpg" },
    { id: "20958", title: "Attack on Titan Season 2", year: 2017, format: "TV", episodes: 12, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20958-HuECi4dt01d7.jpg" },
    { id: "99147", title: "Attack on Titan Season 3", year: 2018, format: "TV", episodes: 12, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx99147-79Fj86D5sNuh.jpg" },
    { id: "10087", title: "Fate/Zero", year: 2011, format: "TV", episodes: 13, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx10087-FkWL1n2q56p0.jpg" },
    { id: "199", title: "千と千尋の神隠し (Spirited Away)", year: 2001, format: "MOVIE", episodes: 1, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx199-3n50g1P0kR30.png" },
    { id: "235", title: "名探偵コナン (Detective Conan)", year: 1996, format: "TV", episodes: 1100, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx235-eG6hNn45p520.png" },
    { id: "1", title: "Cowboy Bebop", year: 1998, format: "TV", episodes: 26, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1-CXtrrkBEOvx0.png" },
    { id: "20507", title: "Noragami", year: 2014, format: "TV", episodes: 12, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20507-7Kz1WJ363Vn0.jpg" },
    { id: "20755", title: "Assassination Classroom", year: 2015, format: "TV", episodes: 22, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20755-9Bdfh6g310d0.jpg" },
    { id: "145064", title: "Jujutsu Kaisen Season 2", year: 2023, format: "TV", episodes: 23, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145064-7O1lEsq08dJb.jpg" },
    { id: "127230", title: "Chainsaw Man", year: 2022, format: "TV", episodes: 12, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-NuZt3whPrxTu.png" },
    { id: "140960", title: "Spy x Family", year: 2022, format: "TV", episodes: 12, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx140960-mooQxNqF3xL2.jpg" },
    { id: "117710", title: "Cyberpunk: Edgerunners", year: 2022, format: "ONA", episodes: 10, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx117710-2l6vD2G7Z1z0.jpg" },
    { id: "131573", title: "Bocchi the Rock!", year: 2022, format: "TV", episodes: 12, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx131573-mR1V9vGf56h0.jpg" },
    { id: "163132", title: "Solo Leveling", year: 2024, format: "TV", episodes: 12, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx163132-YjL00fA85bWj.jpg" },
    { id: "166873", title: "Kaiju No. 8", year: 2024, format: "TV", episodes: 12, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx166873-1p9fL6jE20d0.jpg" }
  ];

  for (const a of catalogAnimes) {
    await sql.query(`
      INSERT INTO "catalog_anime" ("id", "title", "year", "format", "cover", "episodesCount", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "cover" = EXCLUDED."cover", "episodesCount" = EXCLUDED."episodesCount";
    `, [a.id, a.title, a.year, a.format, a.cover, a.episodes]);
  }

  // 3. Inserir rastreamento (tracking) para dev-user e pererinha_id
  const users = ["dev-user", "pererinha_id"];
  const statuses = ["watching", "completed", "on_hold", "planning", "dropped"];

  for (const userId of users) {
    for (let i = 0; i < catalogAnimes.length; i++) {
      const anime = catalogAnimes[i];
      const status = statuses[i % statuses.length];
      const episodesWatched = status === "completed" ? (anime.episodes ?? 12) : Math.floor(i % 10) + 1;
      const score = ((i % 5) + 6);
      const snapshot = JSON.stringify({
        id: anime.id,
        title: anime.title,
        cover: anime.cover,
        format: anime.format,
        year: anime.year,
        episodesCount: anime.episodes,
      });

      await sql.query(`
        INSERT INTO "user_anime_tracking" ("userId", "animeId", "status", "score", "episodesWatched", "animeSnapshot", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId", "animeId") DO UPDATE 
        SET "status" = EXCLUDED."status", "score" = EXCLUDED."score", "episodesWatched" = EXCLUDED."episodesWatched", "animeSnapshot" = EXCLUDED."animeSnapshot";
      `, [userId, anime.id, status, score, episodesWatched, snapshot]);
    }
  }

  // 4. Inserir favoritos adicionais para dev-user e pererinha_id
  for (const userId of users) {
    for (let i = 0; i < 6; i++) {
      const a = catalogAnimes[i];
      await sql.query(`
        INSERT INTO "user_favorite" ("id", "userId", "targetType", "animeId", "position", "createdAt")
        VALUES ($1, $2, 'anime', $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT ("id") DO NOTHING;
      `, [`fav_anime_${userId}_${a.id}`, userId, a.id, i]);
    }
  }

  console.log("Seed de validação concluído com sucesso!");
}

seed().catch(console.error);
