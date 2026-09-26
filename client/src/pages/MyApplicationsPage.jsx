import AsyncState from '../components/AsyncState';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import * as communityService from '../services/communityService';
import EmptyState from '../components/EmptyState';

const MyApplicationsPage = () => {
  const [applications, setApplications] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true);
    setError('');
      try {
        const response = await communityService.getMyApplications();
        setApplications(response.data.applications || []);
      } catch (error) {
        setError('Could not load applications.');
      } finally { setLoading(false); }
    };
  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">My applications</p>
        <h1 className="mt-2 text-3xl font-extrabold text-stone-900">Your active opportunities</h1>
      </div>

      <AsyncState loading={loading} error={error} onRetry={load}>
      {applications.length === 0 ? (
        <EmptyState title="No applications yet" message="Apply to a problem and your statuses will appear here." />
      ) : (
        <div className="space-y-4">
          {applications.map((application) => (
            <div key={application._id} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-bold text-stone-900">{application.project?.title || application.problem?.title || 'Project'}</h3>
                  <p className="mt-1 text-sm text-stone-600">{application.problem?.category || 'General'} • {application.problem?.location?.city || 'Location unavailable'}</p>
                </div>
                <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 border border-brand-200">{application.status}</span>
              </div>
              <div className="mt-4 text-sm text-stone-700">
                <p><strong>Contribution type:</strong> {application.contributionType}</p>
                <p><strong>Relevant skills:</strong> {(application.relevantSkills || []).join(', ') || 'Not provided'}</p>
                <>{application.teamId && <Link className="inline-block my-3 underline text-brand-800 font-semibold" to={`/teams/${application.teamId}`}>Open team workspace</Link>}</><p><strong>Note:</strong> {application.note || 'No note provided'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      </AsyncState>
    </div>
  );
};

export default MyApplicationsPage;
