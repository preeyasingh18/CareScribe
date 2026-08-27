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
 *
 * Every method takes the signed-in `doctorId` and folds it into the query, so a
 * doctor can only ever read or overwrite their own records. The scoping lives
 * here rather than in the routes so a new endpoint cannot forget it: there is no
 * unscoped read available to call.
 */
export function createRepository<T extends WithId = WithId>(model: Model<any>) {
  return {
    /** Return the doctor's documents, newest first, without Mongo internals. */
    async findAll(doctorId: string): Promise<T[]> {
      const docs = await model
        .find({ doctorId }, { _id: 0, __v: 0 })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean()
        .exec();
      return docs as unknown as T[];
    },

    /** Return one of the doctor's documents by its app `id`, or null. */
    async findById(doctorId: string, id: string): Promise<T | null> {
      const doc = await model.findOne({ doctorId, id }, { _id: 0, __v: 0 }).lean().exec();
      return (doc as unknown as T) ?? null;
    },

    /**
     * Return every document matching `filter`, without Mongo internal fields.
     * `sort` is optional (defaults to oldest-first by creation time, which the
     * patient-history endpoint relies on for chronological ordering).
     */
    async findBy(
      doctorId: string,
      filter: Record<string, unknown>,
      sort: Record<string, 1 | -1> = { createdAt: 1, updatedAt: 1 },
    ): Promise<T[]> {
      const docs = await model
        .find({ ...filter, doctorId }, { _id: 0, __v: 0 })
        .sort(sort)
        .lean()
        .exec();
      return docs as unknown as T[];
    },

    /**
     * Insert or update a document by `id`.
     * `replace` overwrites the whole document; otherwise fields are merged.
     */
    async upsert(doctorId: string, doc: T, replace = false): Promise<void> {
      // doctorId is stamped from the session, never from the request body, so a
      // crafted payload cannot write into another doctor's records.
      const { doctorId: _ignored, ...rest } = doc as T & { doctorId?: unknown };
      const owned = { ...rest, doctorId } as unknown as T;

      if (replace) {
        await model.replaceOne({ doctorId, id: doc.id }, owned, { upsert: true }).exec();
      } else {
        await model.updateOne({ doctorId, id: doc.id }, { $set: owned }, { upsert: true }).exec();
      }
    },

    /**
     * Exact total document count (used by the dashboard stats). Uses
     * countDocuments (a real count) rather than estimatedDocumentCount, whose
     * cached collection-metadata value can lag behind recent deletes and report
     * stale totals.
     */
    async count(doctorId: string): Promise<number> {
      return model.countDocuments({ doctorId }).exec();
    },
  };
}
