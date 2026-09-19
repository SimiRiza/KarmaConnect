import mongoose from 'mongoose';

/**
 * Contribution model — expanded in Prompt 2 to minimal working shape.
 *
 * Records an actual contribution (time, skills, money, materials) made
 * by a volunteer to a problem. Distinct from Application (which is the
 * intent to help; this is the recorded act of helping).
 *
 * NOTE on future expansions:
 *   - Prompt 6 (Contributions + Impact Tracking): adds hoursLogged,
 *     verificationStatus, verifiedBy (NGO), receipt documents for money,
 *     structured materials list, full aggregation pipeline for impact reports.
 *   - Prompt 7 (Verification + Trust): adds cryptographic receipt hashes
 *     for financial contributions.
 *
 * MONEY CONTRIBUTIONS: The `amount` field is a PLACEHOLDER only.
 * No real payment gateway is integrated. Prompt 6 will integrate
 * Razorpay (or equivalent) with proper escrow + receipt tracking.
 * This simulates the flow for now.
 */

const contributionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Contribution must reference a user']
    },
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: [true, 'Contribution must reference a problem']
    },
    // Re-uses the CONTRIBUTION_TYPE_ENUM from Application model
    type: {
      type: String,
      required: [true, 'Contribution type is required'],
      enum: {
        values: ['time', 'skills', 'money', 'materials'],
        message: '{VALUE} is not a valid contribution type'
      }
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Note cannot exceed 500 characters'],
      default: ''
    },
    // PLACEHOLDER for money type — real payment integration in Prompt 6
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Amount cannot be negative']
    }
  },
  {
    timestamps: true
  }
);

// Index for user-centric impact queries
contributionSchema.index({ userId: 1, type: 1 });
// Index for problem-centric aggregation
contributionSchema.index({ problemId: 1 });

const Contribution = mongoose.model('Contribution', contributionSchema);
export default Contribution;
