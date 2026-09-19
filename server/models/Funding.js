import mongoose from 'mongoose';
const fundingSchema = new mongoose.Schema({
  csrUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  amountAllocated: {
    type: Number,
    required: true,
    min: 0.01
  },
  amountSpentSoFar: {
    type: Number,
    default: 0,
    min: 0
  },
  allocationDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['allocated', 'in_progress', 'completed', 'withdrawn'],
    default: 'allocated'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: ''
  },
  idempotencyKey: {
    type: String,
    required: true,
    maxlength: 100
  }
}, {
  timestamps: true
});
fundingSchema.index({
  csrUserId: 1,
  idempotencyKey: 1
}, {
  unique: true
});
fundingSchema.index({
  projectId: 1,
  status: 1
});
fundingSchema.index({
  csrUserId: 1,
  status: 1,
  allocationDate: -1
});
export default mongoose.model('Funding', fundingSchema);
