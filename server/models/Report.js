import mongoose from 'mongoose';
export const TARGET_TYPES = ['problem','project','user','ngo','csr_profile'];
export const REPORT_REASONS = ['fake_problem','fake_project','misleading_information','suspicious_activity','inappropriate_content','other'];
export const REPORT_STATUSES = ['pending','reviewed','action_taken','dismissed'];
const schema = new mongoose.Schema({
 reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
 targetType: { type: String, enum: TARGET_TYPES, required: true },
 targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
 reason: { type: String, enum: REPORT_REASONS, required: true },
 description: { type: String, trim: true, required: true, maxlength: 2000 },
 status: { type: String, enum: REPORT_STATUSES, default: 'pending' },
 reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
 reviewNotes: { type: String, default: '', maxlength: 4000 }
}, { timestamps: true });
schema.index({ status: 1, targetType: 1, createdAt: -1 });
export default mongoose.model('Report', schema);
