import { authConfigured, DEV_USER_ID, getSessionUser } from "@/lib/auth/verify.server";
import { getSql } from "@/lib/db";

async function check() {
  console.log("authConfigured:", authConfigured);
  console.log("DEV_USER_ID:", DEV_USER_ID);
  console.log("process.env.VITE_AUTH_ENABLED:", process.env.VITE_AUTH_ENABLED);
  console.log("process.env.DATABASE_URL:", process.env.DATABASE_URL);

  const sql = await getSql();
  const users = await sql`select "id", "name", "email" from "user" limit 10`;
  console.log("Current users in DB:", users);

  const sessions = await sql`select * from "session" limit 10`;
  console.log("Current sessions in DB:", sessions);

  const follows = await sql`select * from "user_follow" limit 10`;
  console.log("Current follows in DB:", follows);
}

check().catch(console.error);
