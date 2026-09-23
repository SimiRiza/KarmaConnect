import mongoose from 'mongoose';
import { PROBLEM_CATEGORIES, PROBLEM_STATUSES } from './Problem.js';

/**
 * Project model — expanded in Prompt 3 (NGO Dashboard).
 *
 * Managed projects created directly by an NGO or converted
 * from an adopted community-posted Problem.
 *
 * NOTE on future expansions:
 *   - Prompt 4 (CSR Dashboard): CSR browsing and simulated allocations reconciled through Funding
 *   - Prompt 5 (Matching + Team Formation): Team workspace; Team.members is authoritative and teamMembers mirrors its IDs
 *   - Prompt 6 (Contributions + Impact): real contributions wiring into `fundingReceived`, receipts, transparency
 */

const materialNeededSchema = new mongoose.Schema(
  {
    item: {
      type: String,
      required: [true, 'Material item name is required'],
      trim: true
    },
    quantityNeeded: {
      type: Number,
      required: [true, 'Quantity needed is required'],
      min: [1, 'Quantity must be at least 1']
    },
    quantityReceived: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { _id: true }
);

const milestoneSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Milestone title is required'],
      trim: true
    },
    targetDate: {
      type: Date,
      default: null
    },
    completed: {
      type: Boolean,
      default: false
    }
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
    outcomesSummary: { type: String, default: '', maxlength: 4000 },
    completedAt: { type: Date, default: null },
    contributionTracking: { type: Boolean, default: false },
    contributionHours: { type: Number, default: 0, min: 0 },
    volunteerFundingSpent: { type: Number, default: 0, min: 0 },
    unattributedSpent: { type: Number, default: 0, min: 0 },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    skillRequests: [{ skillNeeded: { type: String, required: true, trim: true, maxlength: 100 }, hoursNeeded: { type: Number, required: true, min: 0.1 }, description: { type: String, required: true, trim: true, maxlength: 2000 }, status: { type: String, enum: ['open', 'filled'], default: 'open' }, createdAt: { type: Date, default: Date.now } }],
    fundedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    ngoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Project must belong to an NGO']
    },
    sourceProblemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      default: null
    },
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters']
    },
    problemStatement: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1500, 'Problem statement cannot exceed 1500 characters']
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2500, 'Description cannot exceed 2500 characters']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: PROBLEM_CATEGORIES,
        message: '{VALUE} is not a valid category'
      }
    },
    location: {
      city: {
        type: String,
        required: [true, 'City is required'],
        trim: true
      },
      area: {
        type: String,
        trim: true,
        default: ''
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      }
    },
    beneficiaries: {
      estimatedCount: {
        type: Number,
        default: 0,
        min: 0
      },
      description: {
        type: String,
        trim: true,
        default: ''
      }
    },
    requiredSkills: {
      type: [String],
      default: []
    },
    volunteersNeeded: {
      type: Number,
      default: 0,
      min: 0
    },
    teamMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    materialsNeeded: {
      type: [materialNeededSchema],
      default: []
    },
    volunteerHours: { type: Number, default: 0, min: 0 },
    resourceUpdates: [{ note: { type: String, required: true }, fundingSpent: Number, materials: [{ materialId: String, quantityReceived: Number }], createdAt: { type: Date, default: Date.now } }],
    // Prompt 4 reconciles simulated CSR Funding; Prompt 6 adds real payments and volunteer contributions.
    fundingRequired: {
      type: Number,
      default: 0,
      min: 0
    },
    fundingReceived: {
      type: Number,
      default: 0,
      min: 0
    },
    fundingSpent: {
      type: Number,
      default: 0,
      min: 0
    },
    timeline: {
      startDate: {
        type: Date,
        default: null
      },
      expectedEndDate: {
        type: Date,
        default: null
      }
    },
    milestones: {
      type: [milestoneSchema],
      default: []
    },
    status: {
      type: String,
      enum: {
        values: PROBLEM_STATUSES,
        message: '{VALUE} is not a valid status'
      },
      default: 'adopted'
    },
    photos: {
      before: {
        type: [String],
        default: []
      },
      progress: {
        type: [String],
        default: []
      },
      after: {
        type: [String],
        default: []
      }
    }
  },
  {
    timestamps: true
  }
);

// Indexes
projectSchema.index({ ngoId: 1, status: 1 });
projectSchema.index({ sourceProblemId: 1 }, { name: 'unique_source_problem', unique: true, partialFilterExpression: { sourceProblemId: { $type: 'objectId' } } });
projectSchema.index({ 'location.city': 1, category: 1, status: 1 });
projectSchema.index({ title: 'text', description: 'text' });

const Project = mongoose.model('Project', projectSchema);

export default Project;
