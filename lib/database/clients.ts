// You can comment out or delete the imports for the databases you are NOT using.
// However, with dynamic imports, it's safe to leave them for type-checking purposes.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Db } from "mongodb";
import type admin from "firebase-admin";

// --- Client Caching ---
// These will hold the initialized clients to avoid reconnecting on every call.
let cachedSupabase: SupabaseClient | null = null;
let cachedMongoDb: Db | null = null;
let cachedFirebaseAdmin: typeof admin | null = null;

/**
 * Dynamically imports and initializes the Supabase client.
 * Caches the client for subsequent calls.
 */
export async function getSupabaseClient() {
  if (cachedSupabase) {
    return cachedSupabase;
  }
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
  cachedSupabase = createClient(supabaseUrl, supabaseKey);
  return cachedSupabase;
}

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
  const db = client.db(process.env.MONGODB_DB_NAME);
  cachedMongoDb = db;
  return db;
}

/**
 * Dynamically imports and initializes the Firebase Admin SDK.
 * Caches the admin instance.
 */
export async function getFirebaseAdmin() {
  if (cachedFirebaseAdmin) {
    return cachedFirebaseAdmin;
  }
  const admin = (await import("firebase-admin")).default;

  if (!admin.apps.length) {
    const serviceAccount: admin.ServiceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    };
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  cachedFirebaseAdmin = admin;
  return cachedFirebaseAdmin;
}