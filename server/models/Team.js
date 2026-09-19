import mongoose from 'mongoose';

// Placeholder schema: to be expanded in Prompt 5
const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      default: 'forming'
    }
  },
  {
    timestamps: true
  }
);

const Team = mongoose.model('Team', teamSchema);

export default Team;
