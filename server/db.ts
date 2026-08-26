import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';

dotenv.config();

// Accept either MONGODB_URI (preferred / spec name) or MONGO_URI (legacy).
const uri = (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();

// Atlas "mongodb+srv://" URIs require a DNS SRV lookup. Some router/ISP
// resolvers refuse SRV queries (querySrv ECONNREFUSED) even when the cluster
// is perfectly fine — which breaks the connection. Prepend reliable public
// resolvers so the SRV lookup succeeds regardless of the machine's default DNS.
try {
  const publicDns = ['8.8.8.8', '1.1.1.1'];
  const current = dns.getServers();
  dns.setServers([...publicDns, ...current.filter(s => !publicDns.includes(s))]);
} catch {
  // Non-fatal — fall back to the system DNS configuration.
}

let connectPromise: Promise<typeof mongoose> | null = null;

/**
 * Lazily connect to MongoDB via Mongoose and reuse the connection across
 * requests. Routes `await connectDB()` so a transient startup race or reconnect
 * is handled transparently.
 */
export function connectDB(): Promise<typeof mongoose> {
  if (!uri) {
    return Promise.reject(
      new Error('MONGODB_URI (or MONGO_URI) is not set. Add it to your .env file.'),
    );
  }

  if (!connectPromise) {
    mongoose.set('strictQuery', false);
    connectPromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 15000,
      })
      .catch(error => {
        // Reset so the next call retries instead of caching a failed connect.
        connectPromise = null;
        throw error;
      });
  }

  return connectPromise;
}

/** True once Mongoose reports an active (connected) state. */
export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export { mongoose };
