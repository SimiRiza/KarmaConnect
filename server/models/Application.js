import mongoose from 'mongoose';

/**
 * Application model — NEW in Prompt 2 (minimal shape).
 *
 * Records a volunteer's intent to help with a specific problem.
 * This is distinct from Contribution (which records actual work done).
 *
 * NOTE on future expansions:
 *   - Prompt 3 (NGO Dashboard): NGO can accept/reject applications —
 *     `status` field transitions from 'pending' to 'accepted'|'rejected'
 *   - Prompt 5 (Matching + Teams): adds Team formation from accepted applications,
 *     `teamId` ref added here, matching score metadata added
 *
 * ContributionType enum is defined here (Prompt 2 requirement) since
 * the Apply modal needs it even though the full Contribution model
 * is built in Prompt 6.
 */

export const CONTRIBUTION_TYPE_ENUM = ['time', 'skills', 'money', 'materials'];

const applicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Application must reference a user']
    },
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      default: null
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null
    },
    contributionType: {
      type: String,
      required: [true, 'Contribution type is required'],
      enum: {
        values: CONTRIBUTION_TYPE_ENUM,
        message: '{VALUE} is not a valid contribution type'
      }
    },
    // Skills the applicant is offering for this specific problem
    relevantSkills: {
      type: [String],
      default: []
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Note cannot exceed 500 characters'],
      default: ''
    },
    // Prompt 3: pending applications are reviewed atomically with Project.teamMembers.
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'rejected'],
        message: '{VALUE} is not a valid application status'
      },
      default: 'pending'
    }
  },
  {
    timestamps: true
  }
);

// Prevent a user from applying to the same problem twice
applicationSchema.index({ userId: 1, problemId: 1 }, { name: 'unique_problem_application', unique: true, partialFilterExpression: { problemId: { $type: 'objectId' } } });
applicationSchema.index({ userId: 1, projectId: 1 }, { name: 'unique_project_application', unique: true, partialFilterExpression: { projectId: { $type: 'objectId' } } });
applicationSchema.pre('validate', function () {
  if ((!this.problemId && !this.projectId) || (this.problemId && this.projectId)) this.invalidate('problemId', 'Reference exactly one problem or project.');
});

const Application = mongoose.model('Application', applicationSchema);
export default Application;
