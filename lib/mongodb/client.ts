import { MongoClient, type Collection, type Db } from 'mongodb';

/**
 * MongoDB connection utility.
 *
 * This database holds exactly one collection — per-user read markers — and never
 * mirrors users, conversations or messages. The upstream API is the source of
 * truth for all chat data (see README → Architecture).
 *
 * Connection failures are non-fatal by design: `getReadStateCollection()` returns
 * `null` when Mongo is unconfigured or unreachable, and the read-state routes
 * degrade to a 503 that the client handles by falling back to session-local
 * unread tracking. Chat itself never depends on this.
 */

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB ?? 'chat_app';

export interface ReadStateDocument {
  userId: string;
  conversationId: string;
  lastReadAt: Date;
}

/**
 * The client is cached on `globalThis` so Next.js hot reloads in development
 * reuse one connection pool instead of leaking a new one per reload.
 */
declare global {
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> | null {
  if (!MONGODB_URI) return null;

  if (!global.__mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5_000,
    });
    global.__mongoClientPromise = client.connect().catch((error: unknown) => {
      // Clear the cache so a later request can retry rather than reusing a rejected promise.
      global.__mongoClientPromise = undefined;
      throw error;
    });
  }

  return global.__mongoClientPromise;
}

export function isMongoConfigured(): boolean {
  return Boolean(MONGODB_URI);
}

async function getDb(): Promise<Db | null> {
  const clientPromise = getClientPromise();
  if (!clientPromise) return null;
  try {
    const client = await clientPromise;
    return client.db(MONGODB_DB);
  } catch {
    return null;
  }
}

let indexEnsured = false;

/** Returns the read-state collection, or `null` if MongoDB is unavailable. */
export async function getReadStateCollection(): Promise<Collection<ReadStateDocument> | null> {
  const db = await getDb();
  if (!db) return null;

  const collection = db.collection<ReadStateDocument>('readStates');

  if (!indexEnsured) {
    try {
      // One marker per user per conversation, and the lookup key for GET.
      await collection.createIndex({ userId: 1, conversationId: 1 }, { unique: true });
      indexEnsured = true;
    } catch {
      // A missing index degrades performance, not correctness — keep serving.
    }
  }

  return collection;
}
