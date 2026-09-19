import mongoose from 'mongoose';

// NGO adoption must never fall back to nontransactional writes.
export const strictTransaction = async callback => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } catch (error) {
    if (error.code === 20 || /replica set member|Transaction numbers are only allowed/.test(error.message)) {
      throw Object.assign(new Error('This operation requires MongoDB running as a replica set. No changes were saved.'), {
        statusCode: 503
      });
    }
    throw error;
  } finally {
    await session.endSession();
  }
};
