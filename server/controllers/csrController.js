import * as csr from '../services/csrService.js';
import { allocateFunding, withdrawFunding, portfolioSummary } from '../services/fundingService.js';
const endpoint = (fn, key, status = 200) => async (req, res, next) => {
  try {
    const value = await fn(req);
    res.status(status).json({
      success: true,
      ...(key ? {
        [key]: value
      } : value)
    });
  } catch (error) {
    next(error);
  }
};
export const getProfile = endpoint(r => csr.getProfile(r.user.id));
export const updateProfile = endpoint(r => csr.updateProfile(r.user.id, r.body));
export const discover = endpoint(r => csr.discoverProjects(r.query));
export const match = endpoint(r => csr.discoverProjects(r.body, true));
export const detail = endpoint(r => csr.projectDetail(r.params.id), 'project');
export const fund = endpoint(r => allocateFunding(r.user.id, r.params.id, r.body, r.get('Idempotency-Key') || r.body.idempotencyKey), 'funding', 201);
export const fundings = endpoint(r => csr.getFundings(r.user.id, r.query), 'fundings');
export const funding = endpoint(r => csr.getFunding(r.user.id, r.params.id), 'funding');
export const withdraw = endpoint(r => withdrawFunding(r.user.id, r.params.id), 'funding');
export const progress = endpoint(r => csr.progress(r.user.id, r.params.id));
export const report = endpoint(r => csr.report(r.user.id, r.params.projectId), 'report');
export const portfolio = endpoint(r => portfolioSummary(r.user.id), 'summary');
export const dashboard = endpoint(r => csr.dashboard(r.user.id), 'summary');
