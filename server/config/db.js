import mongoose from 'mongoose';

let mongoMemoryServer = null;

/**
 * Connect to MongoDB database.
 * Supports standard MONGODB_URI (e.g. Atlas or local daemon).
 * In development, automatically falls back to in-memory MongoDB if configured or if local connection fails.
 */
export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => mongoose.connection.once('connected', resolve));
    return;
  }
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/karmaconnect';
  const useInMemory = process.env.USE_IN_MEMORY_DB === 'true';

  if (useInMemory) {
    try {
      console.log('⚡ Starting in-memory MongoDB for local development...');
      const { MongoMemoryReplSet, MongoMemoryServer } = await import('mongodb-memory-server');
      
      try {
        // Attempt to start a 1-node in-memory replica set to support native MongoDB transactions
        mongoMemoryServer = await MongoMemoryReplSet.create({
          replSet: { count: 1, storageEngine: 'wiredTiger' }
        });
        const memoryUri = mongoMemoryServer.getUri();
        await mongoose.connect(memoryUri);
        console.log(`✅ Connected to in-memory MongoDB ReplicaSet at: ${memoryUri}`);
        return;
      } catch (replSetErr) {
        console.warn('⚠️ ReplicaSet in-memory failed, falling back to standalone in-memory server:', replSetErr.message);
        mongoMemoryServer = await MongoMemoryServer.create();
        const memoryUri = mongoMemoryServer.getUri();
        await mongoose.connect(memoryUri);
        console.log(`✅ Connected to in-memory MongoDB Server at: ${memoryUri}`);
        return;
      }
    } catch (inMemErr) {
      console.warn('⚠️ Failed to initialize in-memory MongoDB, attempting standard connection:', inMemErr.message);
    }
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ Connected to MongoDB at host: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`⚠️ Could not connect to primary MongoDB URI (${uri}): ${error.message}`);
    if (process.env.NODE_ENV !== 'production' && !mongoMemoryServer) {
      console.log('🔄 Attempting fallback to in-memory MongoDB...');
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        mongoMemoryServer = await MongoMemoryServer.create();
        const memoryUri = mongoMemoryServer.getUri();
        await mongoose.connect(memoryUri);
        console.log(`✅ Fallback connected to in-memory MongoDB at: ${memoryUri}`);
        return;
      } catch (fallbackErr) {
        console.error('❌ In-memory MongoDB fallback also failed:', fallbackErr.message);
      }
    }
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Disconnect from MongoDB and stop in-memory server if running.
 */
export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
    }
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error.message);
  }
};
