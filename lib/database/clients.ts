import type { Db } from "mongodb";

// --- Client Caching ---
// This will hold the initialized client to avoid reconnecting on every call.
let cachedMongoDb: Db | null = null;

/**
 * Dynamically imports and initializes the MongoDB client.
 * Caches the database connection.
 */
export async function getMongoDb() {
  if (cachedMongoDb) {
    return cachedMongoDb;
  }
  const { MongoClient } = await import("mongodb");
  const mongoUri = process.env.MONGODB_URI!;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not defined in .env");
  }
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || "shieldllm");
  cachedMongoDb = db;
  return db;
}