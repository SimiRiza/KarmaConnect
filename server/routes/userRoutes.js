import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import CommunityUserProfile from '../models/CommunityUserProfile.js';
import Problem from '../models/Problem.js';
import Application from '../models/Application.js';
import Contribution from '../models/Contribution.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

const sanitizeLocation = (location) => {
  if (!location) return { city: '', area: '' };
  const { coordinates, ...safeLocation } = location;
  return safeLocation;
};

const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
};

router.use(authenticate);
router.use(authorize('community_user'));

router.get('/me/profile', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const profile = await CommunityUserProfile.findOne({ userId: user._id }).lean();

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location,
        profilePhotoUrl: user.profilePhotoUrl,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      profile: profile || {
        userId: user._id,
        subType: '',
        skills: [],
        interests: [],
        causeAreas: [],
        availability: '',
        bio: '',
        profilePhotoUrl: user.profilePhotoUrl || ''
      }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/me/profile', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const allowedProfileFields = ['skills', 'interests', 'causeAreas', 'availability', 'bio', 'subType', 'profilePhotoUrl'];
    const userUpdates = {};
    const profileUpdates = {};

    if (typeof req.body.name === 'string' && req.body.name.trim()) userUpdates.name = req.body.name.trim();
    if (req.body.location && typeof req.body.location === 'object') {
      const nextLocation = { ...user.location.toObject ? user.location.toObject() : user.location };
      if (typeof req.body.location.city === 'string') nextLocation.city = req.body.location.city.trim();
      if (typeof req.body.location.state === 'string') nextLocation.state = req.body.location.state.trim();
      if (Array.isArray(req.body.location.coordinates) && req.body.location.coordinates.length === 2) {
        nextLocation.coordinates = req.body.location.coordinates;
      }
      userUpdates.location = nextLocation;
    }
    if (typeof req.body.profilePhotoUrl === 'string') {
      userUpdates.profilePhotoUrl = req.body.profilePhotoUrl.trim();
      profileUpdates.profilePhotoUrl = req.body.profilePhotoUrl.trim();
    }

    if (Array.isArray(req.body.skills)) {
      const skills = normalizeStringArray(req.body.skills);
      if (skills.length > 15) return res.status(400).json({ success: false, message: 'Skills cannot exceed 15 items.' });
      profileUpdates.skills = skills;
    }
    if (Array.isArray(req.body.interests)) {
      const interests = normalizeStringArray(req.body.interests);
      if (interests.length > 15) return res.status(400).json({ success: false, message: 'Interests cannot exceed 15 items.' });
      profileUpdates.interests = interests;
    }
    if (Array.isArray(req.body.causeAreas)) {
      const causeAreas = normalizeStringArray(req.body.causeAreas);
      if (causeAreas.length > 15) return res.status(400).json({ success: false, message: 'Cause areas cannot exceed 15 items.' });
      profileUpdates.causeAreas = causeAreas;
    }

    if (typeof req.body.availability === 'string') profileUpdates.availability = req.body.availability.trim();
    if (typeof req.body.bio === 'string') profileUpdates.bio = req.body.bio.trim().slice(0, 1000);
    if (typeof req.body.subType === 'string') profileUpdates.subType = req.body.subType.trim();

    for (const field of Object.keys(req.body)) {
      if (allowedProfileFields.includes(field) && field !== 'profilePhotoUrl' && field !== 'skills' && field !== 'interests' && field !== 'causeAreas' && field !== 'availability' && field !== 'bio' && field !== 'subType') {
        if (field === 'name' || field === 'location') continue;
      }
    }

    if (Object.keys(userUpdates).length) {
      Object.assign(user, userUpdates);
      await user.save();
    }

    let profile = await CommunityUserProfile.findOne({ userId: user._id });
    if (!profile) {
      profile = new CommunityUserProfile({ userId: user._id, subType: req.body.subType || '', skills: [], interests: [], causeAreas: [], availability: '', bio: '' });
    }

    Object.assign(profile, profileUpdates);
    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location,
        profilePhotoUrl: user.profilePhotoUrl,
        phone: user.phone
      },
      profile: profile.toObject()
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me/impact', async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const pipeline = [
      { $match: { userId } },
      {
        $group: {
          _id: null,
          problemIds: { $addToSet: '$problemId' },
          totalContributions: { $sum: 1 },
          totalMoney: { $sum: { $cond: [{ $eq: ['$type', 'money'] }, '$amount', 0] } },
          byType: {
            $push: {
              type: '$type',
              amount: '$amount'
            }
          }
        }
      },
      {
        $lookup: {
          from: 'problems',
          localField: 'problemIds',
          foreignField: '_id',
          as: 'relatedProblems'
        }
      },
      {
        $project: {
          _id: 0,
          problemsParticipatedIn: {
            count: { $size: '$problemIds' },
            list: {
              $map: {
                input: '$relatedProblems',
                as: 'problem',
                in: {
                  _id: '$$problem._id',
                  title: '$$problem.title',
                  status: '$$problem.status',
                  category: '$$problem.category'
                }
              }
            }
          },
          totalContributionsByType: {
            $arrayToObject: {
              $map: {
                input: {
                  $setUnion: [
                    '$byType.type',
                    []
                  ]
                },
                as: 'type',
                in: {
                  k: '$$type',
                  v: {
                    $sum: {
                      $map: {
                        input: '$byType',
                        as: 'entry',
                        in: {
                          $cond: [{ $eq: ['$$entry.type', '$$type'] }, 1, 0]
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          totalMoneyContributed: '$totalMoney',
          completedProjectsCount: {
            $size: {
              $filter: {
                input: '$relatedProblems',
                as: 'problem',
                cond: { $eq: ['$$problem.status', 'completed'] }
              }
            }
          }
        }
      }
    ];

    const result = await Contribution.aggregate(pipeline);
    const summary = result[0] || {
      problemsParticipatedIn: { count: 0, list: [] },
      totalContributionsByType: {},
      totalMoneyContributed: 0,
      completedProjectsCount: 0
    };

    const completedProjects = (await Problem.find({
      _id: { $in: (summary.problemsParticipatedIn?.list || []).map((item) => item._id) },
      status: 'completed'
    }).select('_id title category status createdAt').lean()).map((p) => ({
      _id: p._id,
      title: p.title,
      category: p.category,
      status: p.status,
      createdAt: p.createdAt
    }));

    return res.status(200).json({
      success: true,
      impact: {
        problemsParticipatedIn: summary.problemsParticipatedIn || { count: 0, list: [] },
        totalContributionsByType: summary.totalContributionsByType || {},
        totalMoneyContributed: Number(summary.totalMoneyContributed || 0),
        completedProjectsCount: Number(summary.completedProjectsCount || 0),
        completedProjects
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me/applications', async (req, res, next) => {
  try {
    const applications = await Application.find({ userId: req.user._id })
      .populate('problemId', 'title category status location urgency createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const items = applications.map((application) => ({
      ...application,
      problem: application.problemId ? {
        ...application.problemId,
        location: application.problemId.location ? (() => {
          const { coordinates, ...safeLocation } = application.problemId.location;
          return safeLocation;
        })() : undefined
      } : null
    }));

    return res.status(200).json({ success: true, applications: items });
  } catch (error) {
    next(error);
  }
});

router.get('/me/saved', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).lean();
    const savedIds = user?.savedProblems || [];
    const problems = await Problem.find({ _id: { $in: savedIds } }).sort({ createdAt: -1 }).lean();
    const sanitized = problems.map((problem) => {
      const copy = { ...problem };
      if (copy.location) {
        const { coordinates, ...safeLocation } = copy.location;
        copy.location = safeLocation;
      }
      return copy;
    });
    return res.status(200).json({ success: true, savedProblems: sanitized });
  } catch (error) {
    next(error);
  }
});

export default router;
