import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function main() {
  try {
    const IDs = ['7d4e6f8a-7b8a-4e3c-9a1d-8f3d2c1b5a9e', '3a8b2c1d-4e5f-6a7b-8c9d-0e1f2a3b4c5d', 'a8f225d9-5370-4d3d-aeec-7e72d9cbb855'];
    
    for (const id of IDs) {
      console.log(`--- Checking ID: ${id} ---`);
      const res = await client.execute({
        sql: "SELECT * FROM diary_entries WHERE id = ?;",
        args: [id]
      });
      if (res.rows.length > 0) {
        console.log(`Found: [${res.rows[0].date}] ${res.rows[0].summary}`);
      } else {
        console.log("NOT FOUND");
      }
    }

    console.log(`\n--- Last 5 entries globally ---`);
    const last5 = await client.execute({
      sql: "SELECT id, date, summary, createdAt FROM diary_entries ORDER BY createdAt DESC LIMIT 5;",
      args: []
    });
    last5.rows.forEach(r => {
      console.log(`- [${new Date(Number(r.createdAt)).toLocaleTimeString()}] [${r.date}] [ID: ${r.id}] ${r.summary}`);
    });

  } catch (err) {
    console.error("Query Error:", err);
  }
}

main().catch(console.error);
