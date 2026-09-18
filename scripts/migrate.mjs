#!/usr/bin/env node

/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Runs during `npm run build` and applies pending SQL migrations
 * from ../migrations to DATABASE_URL.
 */

import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";
import { pendingMigrations } from "./migration-plan.mjs";

const databaseUrl = process.env.DATABASE_URL;

function getDatabaseHash(value) {
  if (!value) {
    return "DATABASE_URL_NOT_SET";
  }

  return createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 12);
}

console.log(
  `[migrate] database hash: ${getDatabaseHash(databaseUrl)}`,
);

if (!databaseUrl) {
  console.log(
    "[migrate] DATABASE_URL not set — skipping.",
  );
  process.exit(0);
}

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations",
);

async function main() {
  let entries;

  try {
    entries = await readdir(
      migrationsDir,
      { withFileTypes: true },
    );
  } catch (err) {
    console.error(
      "[migrate] failed to read migrations directory.",
    );

    console.error(
      err?.message || err,
    );

    throw err;
  }

  const migrationEntries = entries
    .map((entry) => entry.name)
    .sort();

  console.log(
    "[migrate] migrations directory:",
    migrationsDir,
  );

  console.log(
    "[migrate] files found:",
    migrationEntries,
  );

  const pendingWithoutDatabase = pendingMigrations(
    migrationEntries,
    [],
  );

  console.log(
    "[migrate] pending migrations before database check:",
    pendingWithoutDatabase.map(
      ({ name }) => name,
    ),
  );

  if (pendingWithoutDatabase.length === 0) {
    console.log(
      "[migrate] no migrations — nothing to do.",
    );
    return;
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 1,
  });

  const client =
    await pool.connect();

  try {
    await client.query(
      `
        CREATE TABLE IF NOT EXISTS _migrations (
          name TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `,
    );

    const appliedRows =
      await client.query(
        "SELECT name FROM _migrations ORDER BY name",
      );

    const applied =
      appliedRows.rows.map(
        (row) => row.name,
      );

    console.log(
      "[migrate] migrations already registered:",
      applied,
    );

    const pending =
      pendingMigrations(
        migrationEntries,
        applied,
      );

    console.log(
      "[migrate] migrations pending after database check:",
      pending.map(
        ({ name }) => name,
      ),
    );

    let count = 0;

    for (const { name } of pending) {
      const migrationPath =
        join(
          migrationsDir,
          name,
        );

      console.log(
        `[migrate] applying ${name}`,
      );

      const text =
        await readFile(
          migrationPath,
          "utf8",
        );

      try {
        await client.query("BEGIN");

        await client.query(text);

        await client.query(
          "INSERT INTO _migrations (name) VALUES ($1)",
          [name],
        );

        await client.query("COMMIT");
      } catch (err) {
        console.error(
          `[migrate] error applying ${name}`,
        );

        try {
          await client.query("ROLLBACK");
        } catch {
          // Keep original error.
        }

        throw err;
      }

      console.log(
        `[migrate] applied ${name}`,
      );

      count += 1;
    }

    console.log(
      count
        ? `[migrate] done — ${count} migration(s) applied.`
        : "[migrate] up to date.",
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(
    "[migrate] failed:",
    err?.message || err,
  );

  for (const key of [
    "code",
    "detail",
    "hint",
    "position",
    "where",
  ]) {
    if (err?.[key] != null) {
      console.error(
        `[migrate]   ${key}: ${err[key]}`,
      );
    }
  }

  process.exit(1);
});
