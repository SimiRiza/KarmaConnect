import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as ngoSvc from '../services/ngoService';
import StatusPipeline from '../components/StatusPipeline';
import FundingProgressBar from '../components/FundingProgressBar';
import ApplicantCard from '../components/ApplicantCard';
import {
  ArrowLeft, Loader2, AlertCircle, Users, MapPin, Calendar,
  CheckCircle, ChevronDown, Image, Edit2, Flag
} from 'lucide-react';

const STATUS_NEXT = {
  adopted: 'team_forming',
  team_forming: 'funding_needed',
  funding_needed: 'in_progress',
  in_progress: null, // use Complete Project button
  completed: null,
};

const STATUS_NEXT_LABEL = {
  adopted: 'Move to Team Forming',
  team_forming: 'Move to Funding Needed',
  funding_needed: 'Move to In Progress',
};

const Section = ({ title, children }) => (
  <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm space-y-4">
    <h2 className="font-bold text-stone-800 text-sm border-b border-stone-100 pb-2">{title}</h2>
    {children}
  </div>
);

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showApplicants, setShowApplicants] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await ngoSvc.getProjectById(id);
      setProject(res.data.project);
    } catch {
      setError('Could not load project.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchApplicants = useCallback(async () => {
    try {
      const res = await ngoSvc.getApplicants(id);
      setApplicants(res.data.applicants || []);
    } catch {
      // silent fail
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
    fetchApplicants();
  }, [fetchProject, fetchApplicants]);

  const advanceStatus = async () => {
    const nextStatus = STATUS_NEXT[project.status];
    if (!nextStatus) return;
    if (!window.confirm(`Move project to "${nextStatus.replace(/_/g, ' ')}"?`)) return;
    setActionLoading(true);
    try {
      const res = await ngoSvc.updateProjectStatus(id, nextStatus);
      setProject(res.data.project);
      setSuccess('Project status updated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setActionLoading(false);
    }
  };

  const completeProject = async () => {
    if (!window.confirm('Mark this project as COMPLETED? This will update NGO impact statistics.')) return;
    setActionLoading(true);
    try {
      const res = await ngoSvc.completeProject(id);
      setProject(res.data.project);
      setSuccess('🎉 Project completed! Impact stats updated.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete project.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReview = async (appId, status) => {
    setActionLoading(true);
    try {
      await ngoSvc.reviewApplicant(id, appId, status);
      await fetchApplicants();
      if (status === 'accepted') await fetchProject();
      setSuccess(`Applicant ${status}.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update applicant.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-brand-600">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="font-bold text-stone-700">{error}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-brand-600 hover:underline">← Go back</button>
      </div>
    );
  }

  const CAT_LABEL = {
    cleaning: 'Cleaning', repair: 'Repair', environment: 'Environment',
    education: 'Education', elderly_support: 'Elderly Support',
    animal_welfare: 'Animal Welfare', health: 'Health', other: 'Other',
  };

  const nextStatus = project ? STATUS_NEXT[project.status] : null;
  const pendingCount = applicants.filter((a) => a.status === 'pending').length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-brand-700 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </button>

      {/* Project Header */}
      {project && (
        <>
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                  {CAT_LABEL[project.category] || project.category}
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 mt-2 leading-snug">{project.title}</h1>
                <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 mt-2">
                  {project.location?.city && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{project.location.city}{project.location.area ? `, ${project.location.area}` : ''}</span>
                  )}
                  {project.timeline?.expectedEndDate && (
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Due {new Date(project.timeline.expectedEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                  )}
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{project.teamMembers?.length || 0}/{project.volunteersNeeded || 0} volunteers</span>
                </div>
              </div>

              {/* Status Actions */}
              <div className="flex flex-col gap-2 shrink-0">
                {nextStatus && nextStatus !== null && (
                  <button
                    onClick={advanceStatus}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-xl transition-colors shadow disabled:opacity-70"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
                    {STATUS_NEXT_LABEL[project.status] || 'Advance Status'}
                  </button>
                )}
                {project.status === 'in_progress' && (
                  <button
                    onClick={completeProject}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl transition-colors shadow disabled:opacity-70"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Complete Project
                  </button>
                )}
              </div>
            </div>

            {/* Status Pipeline */}
            <StatusPipeline currentStatus={project.status} />
          </div>

          {/* Alerts */}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
          {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">{success}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: details */}
            <div className="lg:col-span-2 space-y-5">
              {/* Description */}
              <Section title="About This Project">
                {project.problemStatement && (
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Problem Statement</p>
                    <p className="text-sm text-stone-700 leading-relaxed">{project.problemStatement}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{project.description}</p>
                </div>
              </Section>

              {/* Milestones */}
              {project.milestones?.length > 0 && (
                <Section title="Milestones">
                  <ul className="space-y-2">
                    {project.milestones.map((m) => (
                      <li key={m._id} className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${m.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-stone-300'}`}>
                          {m.completed && <CheckCircle className="w-3 h-3" />}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${m.completed ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{m.title}</p>
                          {m.targetDate && (
                            <p className="text-xs text-stone-400">{new Date(m.targetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Required Skills */}
              {project.requiredSkills?.length > 0 && (
                <Section title="Required Skills">
                  <div className="flex flex-wrap gap-2">
                    {project.requiredSkills.map((s) => (
                      <span key={s} className="text-xs bg-brand-50 text-brand-700 px-2.5 py-1 rounded-full border border-brand-200">{s}</span>
                    ))}
                  </div>
                </Section>
              )}
            </div>

            {/* Right column: stats + applicants */}
            <div className="space-y-5">
              {/* Funding */}
              {project.fundingRequired > 0 && (
                <Section title="Funding">
                  <FundingProgressBar
                    required={project.fundingRequired}
                    received={project.fundingReceived}
                    spent={project.fundingSpent}
                  />
                </Section>
              )}

              {/* Beneficiaries */}
              {(project.beneficiaries?.estimatedCount > 0 || project.beneficiaries?.description) && (
                <Section title="Beneficiaries">
                  {project.beneficiaries.estimatedCount > 0 && (
                    <p className="text-2xl font-extrabold text-brand-700">{project.beneficiaries.estimatedCount.toLocaleString()}</p>
                  )}
                  {project.beneficiaries.description && (
                    <p className="text-xs text-stone-500 leading-relaxed">{project.beneficiaries.description}</p>
                  )}
                </Section>
              )}

              {/* Materials */}
              {project.materialsNeeded?.length > 0 && (
                <Section title="Materials Needed">
                  <ul className="space-y-2">
                    {project.materialsNeeded.map((m) => (
                      <li key={m._id} className="flex justify-between text-xs">
                        <span className="text-stone-700 font-medium">{m.item}</span>
                        <span className="text-stone-500">{m.quantityReceived}/{m.quantityNeeded}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          </div>

          {/* Applicants section */}
          <Section title={`Volunteer Applications (${applicants.length})${pendingCount > 0 ? ` — ${pendingCount} pending` : ''}`}>
            <button
              onClick={() => setShowApplicants(!showApplicants)}
              className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 transition"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showApplicants ? 'rotate-180' : ''}`} />
              {showApplicants ? 'Hide' : 'Show'} Applicants
            </button>

            {showApplicants && (
              <div className="space-y-3 mt-3">
                {applicants.length === 0 ? (
                  <p className="text-sm text-stone-400 text-center py-4">No applications yet.</p>
                ) : (
                  applicants.map((a) => (
                    <ApplicantCard
                      key={a._id}
                      applicant={a}
                      onReview={handleReview}
                      loading={actionLoading}
                    />
                  ))
                )}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
};

export default ProjectDetailPage;
