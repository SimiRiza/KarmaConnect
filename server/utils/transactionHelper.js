import mongoose from 'mongoose';

/**
 * Execute an asynchronous operation inside a MongoDB transaction.
 * If the current MongoDB deployment does not support transactions (e.g., standalone development instance),
 * it executes the callback directly and allows custom rollback logic if an error occurs.
 *
 * @param {Function} callback - Function receiving (session) and returning a promise.
 * @param {Function} [onStandaloneRollback] - Optional cleanup callback if running on standalone MongoDB.
 */
export const runInTransaction = async (callback, onStandaloneRollback) => {
  let session = null;
  try {
    session = await mongoose.startSession();
  } catch (err) {
    // Cannot create session at all, run standalone
    console.warn('⚠️ MongoDB session could not be created; running in standalone mode:', err.message);
    try {
      return await callback(null);
    } catch (cbErr) {
      if (onStandaloneRollback) {
        await onStandaloneRollback(cbErr);
      }
      throw cbErr;
    }
  }

  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } catch (err) {
    // Check if error is due to standalone instance without replica set support
    const isNoReplSet = 
      err.message?.includes('replica set member') || 
      err.message?.includes('Transaction numbers are only allowed') ||
      err.code === 20;

    if (isNoReplSet) {
      console.warn('⚠️ Standalone MongoDB detected (no replica set). Executing with compensating cleanup fallback.');
      try {
        return await callback(null);
      } catch (cbErr) {
        if (onStandaloneRollback) {
          await onStandaloneRollback(cbErr);
        }
        throw cbErr;
      }
    }

    throw err;
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
