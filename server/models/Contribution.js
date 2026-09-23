import mongoose from 'mongoose';
import { validateContribution } from '../services/contributionValidation.js';
const sub = fields => new mongoose.Schema(fields, { _id: false });
const contributionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  // Retained for migration/audit; never count amount alongside moneyContributed.
  problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', default: null },
  note: { type: String, default: '', maxlength: 500 }, amount: { type: Number, default: 0 },
  type: { type: String, enum: ['time', 'skills', 'money', 'materials'], required: true },
  timeContributed: { type: sub({ hours: Number, description: String }), default: undefined },
  skillsContributed: { type: sub({ skills: [String], hoursEquivalent: Number, description: String }), default: undefined },
  moneyContributed: { type: sub({ amount: Number }), default: undefined },
  materialsContributed: { type: sub({ items: [sub({ item: String, quantity: Number })], estimatedValue: Number }), default: undefined },
  status: { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'confirmed' },
  schemaVersion: { type: Number, default: 2 }, legacyNeedsReview: { type: Boolean, default: false },
  legacyReason: String, legacyCurrencyConfirmed: String,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reviewedAt: Date,
  idempotencyKey: String, requestFingerprint: { type: String, select: false }
}, { timestamps: true });
contributionSchema.pre('validate', function () {
  if (this.legacyNeedsReview) {
    if (this.status === 'confirmed') this.invalidate('status', 'Legacy data requires review before confirmation.');
    return;
  }
  if (!this.projectId) this.invalidate('projectId', 'New contributions require a project.');
  try { validateContribution(this.toObject()); } catch (error) { this.invalidate('type', error.message); }
});
contributionSchema.index({ userId: 1, type: 1 });
contributionSchema.index({ problemId: 1 });
contributionSchema.index({ projectId: 1, status: 1 });
contributionSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
export default mongoose.model('Contribution', contributionSchema);
