import { MongoDbAdapter } from './mongodb';
import { DatabaseAdapter } from '@/types/database';

/**
 * Returns the MongoDB database adapter.
 */
export async function getDb(): Promise<DatabaseAdapter> {
  return MongoDbAdapter;
}