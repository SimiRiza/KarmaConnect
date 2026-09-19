import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as ctrl from '../controllers/ngoController.js';

const router = express.Router();

// All NGO routes require authentication + ngo or admin role
router.use(authenticate);
router.use(authorize('ngo', 'admin'));

// ── Dashboard Summary ────────────────────────────────────────
// GET /api/ngo/dashboard
router.get('/dashboard', ctrl.getDashboardSummary);

// ── NGO Profile ──────────────────────────────────────────────
// GET  /api/ngo/profile
// PUT  /api/ngo/profile
router.get('/profile', ctrl.getProfile);
router.put('/profile', ctrl.updateProfile);

// ── Discover Community Problems ──────────────────────────────
// GET /api/ngo/discover-problems?category=&city=&urgency=&search=&page=
router.get('/discover-problems', ctrl.getUnadoptedProblems);

// ── Adopt a Community Problem → creates Project ──────────────
// POST /api/ngo/problems/:id/adopt
router.post('/problems/:id/adopt', ctrl.adoptProblem);

// ── Projects CRUD ────────────────────────────────────────────
// POST /api/ngo/projects          — create a direct (non-problem) project
// GET  /api/ngo/projects          — list NGO's own projects (filter by status)
// GET  /api/ngo/projects/:id      — single project detail
// PUT  /api/ngo/projects/:id      — update project fields
router.post('/projects', ctrl.createProject);
router.get('/projects', ctrl.getProjects);
router.get('/projects/:id', ctrl.getProjectById);
router.put('/projects/:id', ctrl.updateProject);

// ── Project Status Progression ───────────────────────────────
// PATCH /api/ngo/projects/:id/status  { status: "in_progress" }
router.patch('/projects/:id/status', ctrl.updateProjectStatus);

// ── Project Completion ───────────────────────────────────────
// POST /api/ngo/projects/:id/complete
router.post('/projects/:id/complete', ctrl.completeProject);

// ── Project Resources (materials, funding) ───────────────────
// PUT /api/ngo/projects/:id/resources
router.put('/projects/:id/resources', ctrl.updateResources);

// ── Project Photos ───────────────────────────────────────────
// POST /api/ngo/projects/:id/photos  { category: "before"|"progress"|"after", urls: [] }
router.post('/projects/:id/photos', ctrl.uploadPhotos);

// ── Volunteer Applications for a Project ────────────────────
// GET   /api/ngo/projects/:id/applicants
// PATCH /api/ngo/projects/:id/applicants/:appId  { status: "accepted"|"rejected" }
router.get('/projects/:id/applicants', ctrl.getApplicants);
router.patch('/projects/:id/applicants/:appId', ctrl.reviewApplicant);

export default router;
