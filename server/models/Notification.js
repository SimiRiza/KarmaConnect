import mongoose from 'mongoose';
export const NOTIFICATION_TYPES = ['application_accepted','application_rejected','new_matching_project','team_invitation','project_update','contribution_recorded','contribution_confirmed','project_completed','new_volunteer_application','csr_interest','new_contribution','milestone_reminder','new_team_message','skill_request_match','verification_status_changed','report_received'];
const schema = new mongoose.Schema({
 userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
 type: { type: String, enum: NOTIFICATION_TYPES, default: 'project_update' },
 title: { type: String, trim: true, maxlength: 160, default: 'Project update' },
 message: { type: String, trim: true, maxlength: 2000 },
 relatedProjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
 relatedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
 isRead: { type: Boolean, default: false },
 dedupeKey: { type: String, select: false }
}, { timestamps: true });
schema.index({ userId: 1, isRead: 1, createdAt: -1 });
schema.index({ userId: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });
export default mongoose.model('Notification', schema);
