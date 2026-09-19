import Project from '../models/Project.js';
import Application from '../models/Application.js';

// Add constraints without deleting documents or rebuilding unrelated indexes.
export async function prepareNgoIndexes() {
  const duplicates = await Project.aggregate([{
    $match: {
      sourceProblemId: {
        $type: 'objectId'
      }
    }
  }, {
    $group: {
      _id: '$sourceProblemId',
      count: {
        $sum: 1
      }
    }
  }, {
    $match: {
      count: {
        $gt: 1
      }
    }
  }, {
    $limit: 1
  }]);
  if (duplicates.length) throw new Error('Existing projects share a source problem. Resolve these records before enabling NGO project indexes; no records have been removed.');
  await Project.collection.createIndex({
    sourceProblemId: 1
  }, {
    name: 'unique_source_problem',
    unique: true,
    partialFilterExpression: {
      sourceProblemId: {
        $type: 'objectId'
      }
    }
  });
  await Application.collection.createIndex({
    userId: 1,
    problemId: 1
  }, {
    name: 'unique_problem_application',
    unique: true,
    partialFilterExpression: {
      problemId: {
        $type: 'objectId'
      }
    }
  });
  await Application.collection.createIndex({
    userId: 1,
    projectId: 1
  }, {
    name: 'unique_project_application',
    unique: true,
    partialFilterExpression: {
      projectId: {
        $type: 'objectId'
      }
    }
  });
  const indexes = await Application.collection.indexes();
  const legacy = indexes.find(index => index.name === 'userId_1_problemId_1' && index.unique && !index.partialFilterExpression && index.key.userId === 1 && index.key.problemId === 1 && Object.keys(index.key).length === 2);
  // Only replace the known Prompt 2 index after its replacement exists.
  if (legacy) await Application.collection.dropIndex(legacy.name);
}
