import mongoose from 'mongoose';
const ref = { type: mongoose.Schema.Types.ObjectId, ref: 'User' };
const teamSchema = new mongoose.Schema({
  name: { type: String, trim: true }, status: { type: String, default: 'forming' },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  members: [{ userId: { ...ref, required: true }, role: { type: String, default: 'Volunteer', trim: true, maxlength: 80 }, joinedAt: { type: Date, default: Date.now } }],
  tasks: [{ title: { type: String, required: true, trim: true, maxlength: 150 }, description: { type: String, default: '', maxlength: 2000 }, assignedTo: { ...ref, default: null }, dueDate: { type: Date, default: null }, status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' }, createdAt: { type: Date, default: Date.now } }],
  // Polling only. Move messages to a separate indexed collection with pagination if volume grows.
  messages: [{ senderId: { ...ref, required: true }, content: { type: String, required: true, trim: true, maxlength: 4000 }, sentAt: { type: Date, default: Date.now } }],
  meetingSchedule: [{ title: { type: String, required: true, trim: true, maxlength: 150 }, dateTime: { type: Date, required: true }, notes: { type: String, default: '', maxlength: 2000 } }]
}, { timestamps: true });
teamSchema.index({ projectId: 1 }, { unique: true, partialFilterExpression: { projectId: { $type: 'objectId' } } });
export default mongoose.model('Team', teamSchema);
