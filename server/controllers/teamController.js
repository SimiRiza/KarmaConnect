import * as service from '../services/teamService.js';
export const endpoint = fn => async (req, res, next) => {
  try { res.json({ success: true, ...await fn(req) }); } catch (error) { next(error); }
};
export const detail = endpoint(async r => ({ team: await service.detail(r.user.id, r.params.id) }));
export const messages = endpoint(r => service.messages(r.user.id, r.params.id, r.query.before));
export const mutate = operation => endpoint(r => service.mutate(r.user.id, r.params.id, operation, r.params.userId || r.params.taskId, r.body));
export const skillRequest = endpoint(async r => ({ skillRequest: await service.postSkillRequest(r.user.id, r.params.id, r.body) }));
