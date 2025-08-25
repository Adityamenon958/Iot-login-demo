const mongoose = require('mongoose');

// MongoDB connection string
const MONGODB_URI = 'mongodb+srv://adityamenon958:Rekham123%40@cluster1.vldir5y.mongodb.net/dashboardDB?retryWrites=true&w=majority&appName=Cluster1';

async function checkCollectionStatus() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    });
    
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Check collection stats
    console.log('\n📊 Checking cranelogs collection stats...');
    try {
      const stats = await db.collection('cranelogs').stats();
      console.log('✅ Collection stats:');
      console.log('  - Document count:', stats.count);
      console.log('  - Storage size:', (stats.storageSize / 1024 / 1024).toFixed(2), 'MB');
      console.log('  - Index size:', (stats.totalIndexSize / 1024 / 1024).toFixed(2), 'MB');
      console.log('  - Average document size:', (stats.avgObjSize / 1024).toFixed(2), 'KB');
    } catch (error) {
      console.log('❌ Error getting collection stats:', error.message);
    }

    // Check indexes
    console.log('\n🔍 Checking indexes...');
    try {
      const indexes = await db.collection('cranelogs').indexes();
      console.log('✅ Indexes found:', indexes.length);
      indexes.forEach((index, i) => {
        console.log(`  Index ${i + 1}:`, index.name, 'on', index.key);
      });
    } catch (error) {
      console.log('❌ Error getting indexes:', error.message);
    }

    // Try to find documents with different approaches
    console.log('\n🧪 Testing different query approaches...');
    
    // Approach 1: Try with projection (select only specific fields)
    try {
      console.log('  Testing: findOne with projection...');
      const doc1 = await db.collection('cranelogs').findOne({}, { projection: { DeviceID: 1, _id: 0 } });
      console.log('  ✅ Success with projection:', doc1 ? 'Document found' : 'No document');
    } catch (error) {
      console.log('  ❌ Failed with projection:', error.message);
    }

    // Approach 2: Try with limit and skip
    try {
      console.log('  Testing: find with limit and skip...');
      const docs = await db.collection('cranelogs').find({}).limit(1).skip(0).toArray();
      console.log('  ✅ Success with limit/skip:', docs.length, 'documents');
    } catch (error) {
      console.log('  ❌ Failed with limit/skip:', error.message);
    }

    // Approach 3: Try aggregation pipeline
    try {
      console.log('  Testing: aggregation pipeline...');
      const result = await db.collection('cranelogs').aggregate([
        { $limit: 1 },
        { $project: { DeviceID: 1, _id: 0 } }
      ]).toArray();
      console.log('  ✅ Success with aggregation:', result.length, 'documents');
    } catch (error) {
      console.log('  ❌ Failed with aggregation:', error.message);
    }

    // Check if there are any long-running operations
    console.log('\n🔍 Checking for long-running operations...');
    try {
      const operations = await db.admin().currentOp();
      const longOps = operations.inprog.filter(op => op.secs_running > 5);
      if (longOps.length > 0) {
        console.log('⚠️  Long-running operations found:', longOps.length);
        longOps.forEach(op => {
          console.log('  - Operation:', op.opid, 'running for', op.secs_running, 'seconds');
        });
      } else {
        console.log('✅ No long-running operations found');
      }
    } catch (error) {
      console.log('❌ Error checking operations:', error.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    try {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    } catch (e) {
      console.log('⚠️  Error disconnecting:', e.message);
    }
  }
}

// Run the function
checkCollectionStatus();
