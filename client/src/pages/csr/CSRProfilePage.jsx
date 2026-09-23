import VerificationEvidenceUpload from '../../components/VerificationEvidenceUpload';
import React, { useEffect, useState } from 'react';
import * as csr from '../../services/csrService';
import VerificationBadge from '../../components/VerificationBadge';
import SkillsChipInput from '../../components/SkillsChipInput';
import { CATEGORIES, inputClass } from '../../components/ProjectForm';
import { Page, panel } from './CSRLayout';
export default function CSRProfilePage() {
  const [profile, setProfile] = useState(null),
    [form, setForm] = useState(null),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    csr.getProfile().then(r => {
      setProfile(r.data.profile);
      setForm(r.data.profile);
    }).catch(e => setError(e.response?.data?.message || 'Could not load profile.'));
  }, []);
  const save = async e => {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError('');
    try {
      const r = await csr.updateProfile(form);
      setProfile(r.data.profile);
      setForm(r.data.profile);
      setSaved(true);
    } catch (e) {
      setError(e.response?.data?.errors?.map(x => x.message).join(' ') || e.response?.data?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };
  const ranges = ['INR 0-10000', 'INR 10000-50000', 'INR 50000-250000', 'INR 250000-1000000', 'INR 1000000-100000000'];
  return <Page title="Company profile" error={error} loading={!form && !error}>{form && <form onSubmit={save} className={`${panel} max-w-3xl`}><VerificationBadge status={profile.verificationStatus} entity="company" /><p>Verification is reviewed by an administrator. You cannot change this status from your profile.</p><div className="grid sm:grid-cols-2 gap-4">{[['companyName', 'Company name'], ['csrManagerName', 'CSR manager name'], ['industry', 'Industry'], ['companyWebsite', 'Company website']].map(([key, label]) => <label key={key}>{label}<input required={['companyName', 'csrManagerName'].includes(key)} type={key === 'companyWebsite' ? 'url' : 'text'} className={inputClass} value={form[key] || ''} onChange={e => setForm(f => ({
            ...f,
            [key]: e.target.value
          }))} /></label>)}</div><SkillsChipInput label="CSR focus areas" value={form.csrFocusAreas} onChange={csrFocusAreas => setForm(f => ({
        ...f,
        csrFocusAreas
      }))} placeholder="Add a category and press Enter" /><p className="text-sm text-stone-500">Categories: {CATEGORIES.join(', ')}. Existing signup focus labels are also supported.</p><label className="block">Company budget range<select className={inputClass} value={form.budgetRange} onChange={e => setForm(f => ({
          ...f,
          budgetRange: e.target.value
        }))}><option value="">Not set</option>{form.budgetRange && !ranges.includes(form.budgetRange) && <option value={form.budgetRange}>{form.budgetRange} (existing value)</option>}{ranges.map(r => <option key={r}>{r}</option>)}</select></label><p className="text-sm text-stone-600">Project allocations use INR. Legacy dollar ranges are preserved and are not converted automatically for recommendations.</p>{saved && <p role="status" className="text-brand-700">Company profile saved.</p>}<button disabled={busy} className="bg-brand-600 text-white px-5 py-3 rounded-xl disabled:opacity-50">{busy ? 'Saving...' : 'Save company profile'}</button></form>}<VerificationEvidenceUpload type="csr" onStatus={verificationStatus => setProfile(p => p ? ({ ...p, verificationStatus }) : p)} /></Page>;
}
