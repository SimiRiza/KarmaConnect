import mongoose from 'mongoose';
import Project from '../models/Project.js';
import NGOProfile from '../models/NGOProfile.js';
export const recalculateNgoStats = async (ngoId, session = null) => {
  const [stats] = await Project.aggregate([{
    $match: {
      ngoId: new mongoose.Types.ObjectId(String(ngoId)),
      status: 'completed'
    }
  }, {
    $group: {
      _id: null,
      previousProjectsCount: {
        $sum: 1
      },
      totalBeneficiariesReached: {
        $sum: '$beneficiaries.estimatedCount'
      },
      totalVolunteerHours: {
        $sum: { $cond: ['$contributionTracking', '$contributionHours', '$volunteerHours'] }
      }
    }
  }]).session(session);
  const totals = stats || {
    previousProjectsCount: 0,
    totalBeneficiariesReached: 0,
    totalVolunteerHours: 0
  };
  delete totals._id;
  await NGOProfile.updateOne({
    userId: ngoId
  }, {
    $set: totals
  }, {
    session
  });
  return totals;
};
