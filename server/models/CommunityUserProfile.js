import mongoose from 'mongoose';

const communityUserProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    subType: {
      type: String,
      required: [true, 'Community user subtype is required'],
      enum: {
        values: ['student', 'working_professional', 'general_volunteer'],
        message: '{VALUE} is not a valid community user subtype'
      }
    },
    skills: {
      type: [String],
      default: []
    },
    interests: {
      type: [String],
      default: []
    },
    causeAreas: {
      type: [String],
      default: []
    },
    availability: {
      type: String,
      default: ''
    },
    bio: {
      type: String,
      default: '',
      maxlength: [1000, 'Bio cannot exceed 1000 characters']
    },
    collegeOrOrganization: {
      type: String,
      default: '',
      trim: true
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

const CommunityUserProfile = mongoose.model('CommunityUserProfile', communityUserProfileSchema);

export default CommunityUserProfile;
