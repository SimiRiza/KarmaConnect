import mongoose from 'mongoose';
export const verificationFields = {
 verificationEvidence: { type: [{ type: { type: String, required: true, maxlength: 80 }, url: { type: String, required: true }, uploadedAt: { type: Date, default: Date.now } }], default: [], select: false },
 verificationNotes: { type: String, default: '', maxlength: 4000, select: false },
 verificationReviewedAt: { type: Date, default: null },
 verificationReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
};
export function largeProjectThreshold() {
 const n = Number(process.env.LARGE_PROJECT_THRESHOLD ?? 50000);
 if (!Number.isFinite(n) || n < 0 || process.env.LARGE_PROJECT_THRESHOLD === '') throw new Error('LARGE_PROJECT_THRESHOLD must be a non-negative finite INR amount.');
 return n;
}
