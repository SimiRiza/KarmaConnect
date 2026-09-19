import Problem from '../models/Problem.js';
export const literal = value => String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const discoverProblems = async (query = {}, unadopted = false) => {
  const filter = {};
  if (query.city || query.location) filter['location.city'] = {
    $regex: literal(query.city || query.location),
    $options: 'i'
  };
  for (const field of ['category', 'urgency', 'status']) if (query[field]) filter[field] = String(query[field]);
  if (query.resources) filter.estimatedResourcesNeeded = {
    $regex: literal(query.resources),
    $options: 'i'
  };
  if (query.search) filter.$or = ['title', 'description'].map(field => ({
    [field]: {
      $regex: literal(query.search),
      $options: 'i'
    }
  }));
  if (unadopted) Object.assign(filter, {
    status: 'reported',
    adoptedByNgoId: null,
    linkedProjectId: null
  });
  const integer = (value, fallback, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(1, Math.floor(Number(value)))) : fallback;
  const page = integer(query.page ?? 1, 1, 100000);
  const limit = integer(query.limit ?? 10, 10, 50);
  const [result] = await Problem.aggregate([{
    $match: filter
  }, {
    $addFields: {
      urgencyOrder: {
        $indexOfArray: [['low', 'medium', 'high'], '$urgency']
      }
    }
  }, {
    $sort: query.sort === 'most_urgent' ? {
      urgencyOrder: -1,
      createdAt: -1,
      _id: -1
    } : {
      createdAt: -1,
      _id: -1
    }
  }, {
    $facet: {
      count: [{
        $count: 'total'
      }],
      items: [{
        $skip: (page - 1) * limit
      }, {
        $limit: limit
      }, {
        $project: {
          'location.coordinates': 0,
          urgencyOrder: 0
        }
      }]
    }
  }]);
  await Problem.populate(result.items, {
    path: 'postedBy',
    select: 'name profilePhotoUrl'
  });
  const total = result.count[0]?.total || 0;
  return {
    items: result.items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};
