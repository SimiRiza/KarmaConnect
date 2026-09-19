import mongoose from 'mongoose';
import { PROBLEM_CATEGORIES, PROBLEM_STATUSES } from './Problem.js';

/**
 * Project model — expanded in Prompt 3 (NGO Dashboard).
 *
 * Managed projects created directly by an NGO or converted
 * from an adopted community-posted Problem.
 *
 * NOTE on future expansions:
 *   - Prompt 4 (CSR Dashboard): CSR browsing, sponsorship proposals, corporate grants
 *   - Prompt 5 (Matching + Team Formation): full team workspace, chat, volunteer tasks built on `teamMembers`
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
projectSchema.index({ sourceProblemId: 1 });
projectSchema.index({ 'location.city': 1, category: 1, status: 1 });
projectSchema.index({ title: 'text', description: 'text' });

const Project = mongoose.model('Project', projectSchema);

export default Project;
