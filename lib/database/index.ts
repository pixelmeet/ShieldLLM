import { DatabaseAdapter } from '@/types/database';

let cachedDbAdapter: DatabaseAdapter | null = null;

/**
 * Dynamically loads and returns the configured database adapter.
 * Caches the adapter for subsequent calls.
 */
export async function getDb(): Promise<DatabaseAdapter> {
  if (cachedDbAdapter) {
    return cachedDbAdapter;
  }

  const provider = process.env.DATABASE_PROVIDER;

  switch (provider) {
    case 'supabase':
      cachedDbAdapter = (await import('./supabase')).SupabaseAdapter;
      break;
    case 'mongodb':
      cachedDbAdapter = (await import('./mongodb')).MongoDbAdapter;
      break;
    case 'firebase':
      cachedDbAdapter = (await import('./firebase')).FirebaseAdapter;
      break;
    default:
      throw new Error(`Unsupported database provider: ${provider}. Please set DATABASE_PROVIDER in .env to "supabase", "mongodb", or "firebase".`);
  }
  
  return cachedDbAdapter;
}