import mongoose from 'mongoose';

// Placeholder schema: to be expanded in Prompt 6
const impactRecordSchema = new mongoose.Schema(
  {
    metricName: {
      type: String,
      trim: true
    },
    value: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

const ImpactRecord = mongoose.model('ImpactRecord', impactRecordSchema);

export default ImpactRecord;
