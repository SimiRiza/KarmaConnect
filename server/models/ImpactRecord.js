import mongoose from 'mongoose';
const impactRecordSchema = new mongoose.Schema({
  metricName: String, value: { type: Number, default: 0 }, // Preserve old placeholders.
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  title: String, description: String, category: String, location: { city: String, area: String },
  beneficiariesReached: { type: Number, min: 0 }, totalVolunteerHours: { type: Number, min: 0 },
  totalMoneyRaised: { type: Number, min: 0 }, totalMoneySpent: { type: Number, min: 0 },
  fundingRequired: { type: Number, min: 0 },
  fundingBreakdown: { fromVolunteers: Number, fromCSR: Number, total: Number },
  totalMaterialsContributed: [{ item: String, quantity: Number, _id: false }],
  volunteersInvolvedCount: { type: Number, min: 0 },
  ngoInvolved: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  csrFundersInvolved: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  ngoName: String, csrCredits: [{ userId: mongoose.Schema.Types.ObjectId, companyName: String, _id: false }],
  beforePhotos: [String], progressPhotos: [String], afterPhotos: [String],
  completedMilestones: [String], outcomesSummary: String, completedAt: { type: Date, default: null },
  reconstructed: { type: Boolean, default: false },
  simulated: { type: Boolean, default: true }, currency: { type: String, default: 'INR' }
}, { timestamps: true });
// Insert once: later edits never rewrite a completion snapshot.
impactRecordSchema.index({ projectId: 1 }, { unique: true, partialFilterExpression: { projectId: { $type: 'objectId' } } });
impactRecordSchema.index({ category: 1, 'location.city': 1, createdAt: -1 });
export default mongoose.model('ImpactRecord', impactRecordSchema);
