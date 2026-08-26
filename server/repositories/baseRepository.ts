import type { Model } from 'mongoose';

export interface WithId {
  id: string;
  [key: string]: unknown;
}

/**
 * Generic data-access layer for an `id`-keyed collection.
 *
 * Every CareScribe collection is keyed by an app-provided string `id`
 * (not Mongo's ObjectId), so a single repository implementation serves them
 * all. API responses hide Mongo internals (`_id`) to keep shapes identical
 * to what the frontend expects.
 */
export function createRepository<T extends WithId = WithId>(model: Model<any>) {
  return {
    /** Return every document, newest first, without Mongo internal fields. */
    async findAll(): Promise<T[]> {
      const docs = await model
        .find({}, { _id: 0, __v: 0 })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean()
        .exec();
      return docs as unknown as T[];
    },

    /** Return a single document by its app `id`, or null. */
    async findById(id: string): Promise<T | null> {
      const doc = await model.findOne({ id }, { _id: 0, __v: 0 }).lean().exec();
      return (doc as unknown as T) ?? null;
    },

    /**
     * Return every document matching `filter`, without Mongo internal fields.
     * `sort` is optional (defaults to oldest-first by creation time, which the
     * patient-history endpoint relies on for chronological ordering).
     */
    async findBy(
      filter: Record<string, unknown>,
      sort: Record<string, 1 | -1> = { createdAt: 1, updatedAt: 1 },
    ): Promise<T[]> {
      const docs = await model.find(filter, { _id: 0, __v: 0 }).sort(sort).lean().exec();
      return docs as unknown as T[];
    },

    /**
     * Insert or update a document by `id`.
     * `replace` overwrites the whole document; otherwise fields are merged.
     */
    async upsert(doc: T, replace = false): Promise<void> {
      if (replace) {
        await model.replaceOne({ id: doc.id }, doc, { upsert: true }).exec();
      } else {
        await model.updateOne({ id: doc.id }, { $set: doc }, { upsert: true }).exec();
      }
    },

    /**
     * Exact total document count (used by the dashboard stats). Uses
     * countDocuments (a real count) rather than estimatedDocumentCount, whose
     * cached collection-metadata value can lag behind recent deletes and report
     * stale totals.
     */
    async count(): Promise<number> {
      return model.countDocuments({}).exec();
    },
  };
}
