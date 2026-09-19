import React, { useEffect, useState } from 'react';
import * as ngoSvc from '../services/ngoService';
import SkillsChipInput from '../components/SkillsChipInput';
import VerificationBadge from '../components/VerificationBadge';
import RepeatableFieldList from '../components/RepeatableFieldList';
import { Save, Loader2, Plus, Trash2, User } from 'lucide-react';

const FIELD = ({ label, children }) => (
  <div>
    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">{label}</label>
    {children}
  </div>
);

const INPUT = (props) => (
  <input
    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition"
    {...props}
  />
);

const TEXTAREA = (props) => (
  <textarea
    rows={4}
    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition resize-none"
    {...props}
  />
);

const NGOProfilePage = () => {
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Editable form state
  const [form, setForm] = useState({
    ngoName: '',
    about: '',
    causeAreas: [],
    locationsServed: [],
    contactPersonName: '',
    contactPhone: '',
    photos: [],
    team: [],
  });

  useEffect(() => {
    ngoSvc.getProfile().then((res) => {
      const { user: u, profile: p } = res.data;
      setUser(u);
      setProfile(p);
      setForm({
        ngoName: p.ngoName || '',
        about: p.about || '',
        causeAreas: p.causeAreas || [],
        locationsServed: p.locationsServed || [],
        contactPersonName: p.contactPersonName || '',
        contactPhone: p.contactPhone || '',
        photos: p.photos || [],
        team: p.team || [],
      });
    }).catch(() => setError('Could not load profile.')).finally(() => setLoading(false));
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleTeamChange = (idx, field, value) => {
    const updated = form.team.map((m, i) => i === idx ? { ...m, [field]: value } : m);
    setForm((f) => ({ ...f, team: updated }));
  };

  const addTeamMember = () => {
    setForm((f) => ({ ...f, team: [...f.team, { name: '', role: '', photoUrl: '' }] }));
  };

  const removeTeamMember = (idx) => {
    setForm((f) => ({ ...f, team: f.team.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await ngoSvc.updateProfile(form);
      setProfile(res.data.profile);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.errors?.map(e => e.message).join(' ') || err.response?.data?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-brand-600">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">NGO Profile</h1>
          <p className="text-sm text-stone-500 mt-1">Update your organisation details and team</p>
        </div>
        {profile?.verificationStatus && (
          <VerificationBadge status={profile.verificationStatus} />
        )}
      </div>

      {/* Read-only info */}
      <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 text-sm space-y-1">
        <p className="text-stone-500">Registration Number: <span className="font-semibold text-stone-800">{profile?.registrationNumber}</span></p>
        {user?.email && <p className="text-stone-500">Account Email: <span className="font-semibold text-stone-800">{user.email}</span></p>}
      </div>

      <p className="bg-brand-50 border border-brand-200 rounded-xl p-4">Verification confirms that your organization has been reviewed. Only an administrator can change this status. Verified NGOs can adopt problems and create projects.</p>
      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FIELD label="NGO Name">
            <INPUT value={form.ngoName} onChange={set('ngoName')} placeholder="Organisation full name" required />
          </FIELD>
          <FIELD label="Contact Person Name">
            <INPUT value={form.contactPersonName} onChange={set('contactPersonName')} placeholder="Full name" />
          </FIELD>
          <FIELD label="Contact Phone">
            <INPUT value={form.contactPhone} onChange={set('contactPhone')} placeholder="+91 …" />
          </FIELD>
        </div>

        <FIELD label="About the Organisation">
          <TEXTAREA value={form.about} onChange={set('about')} placeholder="Mission, programs, reach…" />
        </FIELD>

        <FIELD label="Cause / Focus Areas">
          <SkillsChipInput
            value={form.causeAreas}
            onChange={(v) => setForm((f) => ({ ...f, causeAreas: v }))}
            placeholder="e.g. Environment, Education"
            addLabel="Add Cause Area"
          />
        </FIELD>

        <FIELD label="Locations Served (Cities / Districts)">
          <SkillsChipInput
            value={form.locationsServed}
            onChange={(v) => setForm((f) => ({ ...f, locationsServed: v }))}
            placeholder="e.g. Mumbai, Pune"
            addLabel="Add Location"
          />
        </FIELD>

        <FIELD label="Organization photo URLs"><RepeatableFieldList items={form.photos} onChange={photos => setForm(f => ({ ...f, photos }))} placeholder="https://..." addLabel="Add photo" /></FIELD>
        <div className="grid grid-cols-3 gap-3">{form.photos.filter(Boolean).map((url, i) => <img key={i} src={url} alt="Organization" className="h-24 w-full object-cover rounded-xl" />)}</div>
        {/* Team Members */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Team Members</label>
            <button type="button" onClick={addTeamMember} className="text-xs font-semibold text-brand-700 flex items-center gap-1 hover:text-brand-800">
              <Plus className="w-3.5 h-3.5" /> Add Member
            </button>
          </div>
          <div className="space-y-3">
            {form.team.map((member, idx) => (
              <div key={idx} className="flex flex-wrap gap-2 items-center bg-stone-50 rounded-xl p-3 border border-stone-100">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {member.photoUrl ? <img src={member.photoUrl} alt={member.name || 'Team member'} className="w-8 h-8 rounded-full object-cover" /> : member.name ? member.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <INPUT
                  aria-label="Team member name" required value={member.name}
                  onChange={(e) => handleTeamChange(idx, 'name', e.target.value)}
                  placeholder="Full name"
                  className="flex-1 border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm text-stone-800 focus:outline-none focus:border-brand-400 transition"
                />
                <INPUT
                  aria-label="Team member role" required value={member.role}
                  onChange={(e) => handleTeamChange(idx, 'role', e.target.value)}
                  placeholder="Role / Title"
                  className="flex-1 border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm text-stone-800 focus:outline-none focus:border-brand-400 transition"
                />
                <INPUT aria-label="Team member photo URL" value={member.photoUrl} onChange={e => handleTeamChange(idx, 'photoUrl', e.target.value)} placeholder="Photo URL (optional)" />
                <button aria-label="Remove team member" type="button" onClick={() => removeTeamMember(idx)} className="p-1.5 text-red-400 hover:text-red-600 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {form.team.length === 0 && (
              <p className="text-xs text-stone-400 text-center py-3">No team members added yet.</p>
            )}
          </div>
        </div>

        {/* Alerts */}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
        {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">{success}</div>}

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition-colors shadow disabled:opacity-70"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
};

export default NGOProfilePage;
