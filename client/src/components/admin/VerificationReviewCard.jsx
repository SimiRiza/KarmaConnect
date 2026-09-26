import React, { useState } from 'react';
import api from '../../services/api';
import VerificationBadge from '../VerificationBadge';
export default function VerificationReviewCard({
  profile,
  onChanged
}) {
  const [notes, setNotes] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const review = async status => {
    if (!notes.trim()) {
      setError('Review notes are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.patch('/admin/verifications/' + profile.profileType + '/' + profile._id, {
        verificationStatus: status,
        verificationNotes: notes
      });
      await onChanged('Verification ' + status + '.');
    } catch (e) {
      setError(e.response?.data?.message || 'Review failed.');
    } finally {
      setBusy(false);
    }
  };
  const download = async url => {
    try {
      const r = await api.get(url.replace(/^\/api/, ''), {
        responseType: 'blob'
      });
      const u = URL.createObjectURL(r.data),
        a = document.createElement('a');
      a.href = u;
      a.download = url.split('/').at(-1);
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch {
      setError('Document unavailable. Please retry.');
    }
  };
  return <article className="bg-white border rounded-xl p-5 space-y-3"><h2 className="text-xl font-bold">{profile.ngoName || profile.companyName}</h2><VerificationBadge status={profile.verificationStatus} entity={profile.profileType === 'ngo' ? 'NGO' : 'company'} /><p>{profile.about || profile.industry || 'No organization description provided.'}</p><p className="text-sm">{profile.registrationNumber || profile.companyWebsite}</p><ul>{profile.verificationEvidence?.map((e, i) => <li key={e._id}><button onClick={() => download(e.url)} className="underline text-brand-800">Download {e.type.replaceAll('_', ' ')} {i + 1}</button></li>)}</ul>{!profile.verificationEvidence?.length && <p>No documents uploaded.</p>}{profile.verificationReviewedAt && <p className="text-sm">Last reviewed {new Date(profile.verificationReviewedAt).toLocaleString()}: {profile.verificationNotes || 'No notes'}</p>}<label className="block">Review notes (required)<textarea required maxLength={4000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="block w-full border rounded-lg p-2" /></label>{error && <p role="alert" className="text-red-800">{error}</p>}<div className="flex gap-3"><button disabled={busy} onClick={() => review('verified')} className="bg-brand-700 text-white rounded-lg px-4 py-2">Approve</button><button disabled={busy} onClick={() => review('rejected')} className="border border-red-300 text-red-800 rounded-lg px-4 py-2">Reject</button></div></article>;
}
