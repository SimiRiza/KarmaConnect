import Project from '../models/Project.js';
import Application, { CONTRIBUTION_TYPE_ENUM } from '../models/Application.js';
import Team from '../models/Team.js';
import { strictTransaction } from '../utils/strictTransaction.js';
import { validId, fail } from './fundingService.js';
import { text } from './teamService.js';

export async function projectDetail(userId, id) {
  const project = await Project.findById(validId(id)).select('-location.coordinates -fundedBy -teamMembers -resourceUpdates').populate('sourceProblemId', 'urgency').lean();
  if (!project) fail('Project not found.', 404);
  const team = await Team.findOne({ projectId: id, 'members.userId': userId }).select('_id').lean();
  return { project: { ...project, teamId: team?._id || null } };
}
export const apply = (userId, id, data) => strictTransaction(async session => {
  const project = await Project.findOneAndUpdate({ _id: validId(id) }, { $inc: { __v: 1 } }, { new: true, session });
  if (!project) fail('Project not found.', 404);
  if (project.status === 'completed') fail('This project is completed.', 409);
  if (!CONTRIBUTION_TYPE_ENUM.includes(data.contributionType)) fail('Invalid contribution type.');
  if (data.relevantSkills !== undefined && (!Array.isArray(data.relevantSkills) || data.relevantSkills.length > 30 || data.relevantSkills.some(s => typeof s !== 'string' || s.length > 100))) fail('Invalid skills.');
  const target = project.sourceProblemId ? { problemId: project.sourceProblemId } : { projectId: id };
  if (await Application.exists({ userId, $or: [{ projectId: id }, ...(project.sourceProblemId ? [{ problemId: project.sourceProblemId }] : [])] }).session(session)) fail('You have already applied.', 409);
  const [application] = await Application.create([{ userId, ...target, contributionType: data.contributionType, relevantSkills: data.relevantSkills || [], note: text(data.note ?? '', 'note', 500, false) }], { session });
  return { application };
});
