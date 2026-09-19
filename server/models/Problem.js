import mongoose from 'mongoose';

/**
 * Problem model — expanded in Prompt 2 from placeholder.
 *
 * NOTE on future expansions:
 *   - Prompt 3: adoptedByNgoId + linkedProjectId reciprocally link an adopted Project
 *   - Prompt 5 (Matching + Teams): adds `teamId` ref, matching metadata
 *   - Prompt 6 (Contributions + Impact): adds structured `fundingGoal`,
 *     `fundingCollected`, `fundingSpent` transparency fields
 */

const CATEGORY_ENUM = [
  'cleaning',
  'repair',
  'environment',
  'education',
  'elderly_support',
  'animal_welfare',
  'health',
  'other'
];

const STATUS_ENUM = [
  'reported',       // 🟡 Default — newly posted, not yet adopted
  'adopted',        // NGO has taken ownership (Prompt 3)
  'team_forming',   // 🔵 Volunteers being recruited
  'funding_needed', // 🟠 Needs CSR/public funding
  'in_progress',    // 🟣 Active work happening
  'completed'       // 🟢 Problem resolved
];

const problemSchema = new mongoose.Schema(
  {
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Problem must have a poster']
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: CATEGORY_ENUM,
        message: '{VALUE} is not a valid category'
      }
    },
    // Photos stored as URL strings.
    // LOCAL DEV: served from server/uploads/ as /uploads/<filename>
    // PRODUCTION TODO: swap for Cloudinary/S3 signed URLs (see upload.js)
    photos: {
      type: [String],
      default: []
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
      // PRIVACY: store only approximate area coordinates — never the
      // poster's exact home address. Never return raw coordinates to the
      // client; only city + area text is sent in list responses.
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      }
    },
    urgency: {
      type: String,
      required: [true, 'Urgency level is required'],
      enum: {
        values: ['low', 'medium', 'high'],
        message: '{VALUE} is not a valid urgency level'
      }
    },
    // Free-text for now; will be structured in a later prompt
    estimatedResourcesNeeded: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: {
        values: STATUS_ENUM,
        message: '{VALUE} is not a valid status'
      },
      default: 'reported'
    },
    adoptedByNgoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    linkedProjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Geospatial index for future proximity queries (Prompt 5)
problemSchema.index({ 'location.coordinates': '2dsphere' });

// Text index for simple title/description search on Discover page
problemSchema.index({ title: 'text', description: 'text' });

// Compound index for common filter patterns: city + category + status
problemSchema.index({ 'location.city': 1, category: 1, status: 1 });

export const PROBLEM_CATEGORIES = CATEGORY_ENUM;
export const PROBLEM_STATUSES = STATUS_ENUM;

const Problem = mongoose.model('Problem', problemSchema);
export default Problem;
