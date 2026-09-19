import mongoose from 'mongoose';

const ngoProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    ngoName: {
      type: String,
      required: [true, 'NGO name is required'],
      trim: true,
      maxlength: [150, 'NGO name cannot exceed 150 characters']
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      trim: true
    },
    registrationDocumentUrl: {
      type: String,
      default: ''
    },
    causeAreas: {
      type: [String],
      default: []
    },
    locationsServed: {
      type: [String],
      default: []
    },
    about: {
      type: String,
      default: '',
      maxlength: [2000, 'About description cannot exceed 2000 characters']
    },
    contactPersonName: {
      type: String,
      default: '',
      trim: true
    },
    contactPhone: {
      type: String,
      default: '',
      trim: true
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    previousProjectsCount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalBeneficiariesReached: {
      type: Number,
      default: 0,
      min: 0
    },
    totalVolunteerHours: {
      type: Number,
      default: 0,
      min: 0
    },
    team: [
      {
        name: {
          type: String,
          required: true,
          trim: true
        },
        role: {
          type: String,
          required: true,
          trim: true
        },
        photoUrl: {
          type: String,
          default: ''
        }
      }
    ]
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

const NGOProfile = mongoose.model('NGOProfile', ngoProfileSchema);

export default NGOProfile;
