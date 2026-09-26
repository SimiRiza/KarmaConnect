import React, { useState } from 'react';
import api from '../../services/api';
import AsyncState from '../AsyncState';
export default function ReportReviewCard({
  report,
  onChanged
}) {
  const [detail, setDetail] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState('reviewed'),
    [notes, setNotes] = useState(''),
    [flag, setFlag] = useState(false),
    [busy, setBusy] = useState(false);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setDetail((await api.get('/admin/reports/' + report._id)).data);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load reported content.');
    } finally {
      setLoading(false);
    }
  };
  const save = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.patch('/admin/reports/' + report._id, {
        status,
        reviewNotes: notes,
        flagTarget: flag && status === 'action_taken'
      });
      await onChanged('Report reviewed.');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save review.');
    } finally {
      setBusy(false);
    }
  };
  return <article className="bg-white border rounded-xl p-5 space-y-3"><h2 className="font-bold text-lg">{report.targetType.replaceAll('_', ' ')} / {report.reason.replaceAll('_', ' ')}</h2><p>Status: {report.status.replaceAll('_', ' ')}</p><p className="whitespace-pre-wrap break-words">{report.description}</p><button onClick={load} className="underline text-brand-800">View reported content</button><AsyncState loading={loading} error={error} onRetry={load}>{detail && <div className="bg-canvas-subtle p-4 rounded-lg space-y-2"><p>Reported by {detail.report.reportedBy?.name || 'Deleted user'} ({detail.report.reportedBy?.email || 'email unavailable'})</p>{detail.targetMissing ? <p>The reported content has been deleted.</p> : <><h3 className="font-bold">{detail.target.title || detail.target.ngoName || detail.target.companyName || detail.target.name}</h3><p>{detail.target.description || detail.target.about || detail.target.email || detail.target.industry}</p><p>{detail.target.location?.city} {detail.target.status || detail.target.verificationStatus || detail.target.role}</p>{(Array.isArray(detail.target.photos) ? detail.target.photos : detail.target.photos?.before || []).map((url, i) => <img key={url + i} src={url} alt={'Reported evidence ' + (i + 1)} className="max-h-48 max-w-full rounded-lg" />)}</>}</div>}</AsyncState><form onSubmit={save} className="space-y-3"><label className="block">Review status<select className="block border rounded-lg p-2" value={status} onChange={e => setStatus(e.target.value)}>{['reviewed', 'action_taken', 'dismissed'].map(v => <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>)}</select></label><label className="block">Review notes<textarea required maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)} className="block w-full border rounded-lg p-2" /></label>{status === 'action_taken' && ['problem', 'project'].includes(report.targetType) && <label className="flex gap-2"><input type="checkbox" checked={flag} onChange={e => setFlag(e.target.checked)} />Flag this content for investigation</label>}<button disabled={busy} className="bg-brand-700 text-white px-4 py-2 rounded-lg">Save report review</button></form></article>;
}
