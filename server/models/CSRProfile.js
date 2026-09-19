import mongoose from 'mongoose';

const csrProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [150, 'Company name cannot exceed 150 characters']
    },
    csrManagerName: {
      type: String,
      required: [true, 'CSR manager name is required'],
      trim: true
    },
    industry: {
      type: String,
      default: '',
      trim: true
    },
    csrFocusAreas: {
      type: [String],
      default: []
    },
    budgetRange: {
      type: String,
      default: ''
    },
    companyWebsite: {
      type: String,
      default: '',
      trim: true
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

const CSRProfile = mongoose.model('CSRProfile', csrProfileSchema);

export default CSRProfile;
