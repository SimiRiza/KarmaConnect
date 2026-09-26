import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    isSuspended: { type: Boolean, default: false },
    bootstrapAdmin: { type: Boolean, select: false },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false // Never return passwordHash by default
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ['community_user', 'ngo', 'csr_manager', 'admin'],
        message: '{VALUE} is not a valid account role'
      }
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String,
      select: false
    },
    emailVerificationExpiry: {
      type: Date,
      select: false
    },
    passwordResetToken: {
      type: String,
      select: false
    },
    passwordResetExpiry: {
      type: Date,
      select: false
    },
    profilePhotoUrl: {
      type: String,
      default: ''
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    location: {
      city: {
        type: String,
        trim: true,
        default: ''
      },
      state: {
        type: String,
        trim: true,
        default: ''
      },
      coordinates: {
        type: [Number], // Format: [longitude, latitude]
        default: [0, 0],
        validate: {
          validator: (coords) => Array.isArray(coords) && coords.length === 2,
          message: 'Coordinates must be an array of [longitude, latitude]'
        }
      }
    },
    savedProblems: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Problem',
      default: []
    },
    refreshTokens: {
      type: [String],
      default: [],
      select: false // Stored as sha256 hashes, not returned by default
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.refreshTokens;
        delete ret.emailVerificationToken;
        delete ret.passwordResetToken;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// 2dsphere index for future geospatial and proximity queries
userSchema.index({ 'location.coordinates': '2dsphere' });

userSchema.index({ bootstrapAdmin: 1 }, { unique: true, partialFilterExpression: { bootstrapAdmin: true } });
const User = mongoose.model('User', userSchema);

export default User;
