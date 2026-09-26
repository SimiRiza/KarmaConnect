import AsyncState from '../components/AsyncState';
import React, { useState, useEffect } from 'react';
import ReportModal from '../components/ReportModal';
import { useAuth } from '../context/AuthContext';
import * as communityService from '../services/communityService';
import SkillsChipInput from '../components/SkillsChipInput';

const ProfilePage = () => {
  const { user: currentUser, setUser, setProfile } = useAuth();
  const [form, setForm] = useState({
    name: '',
    profilePhotoUrl: '',
    location: { city: '', state: '' },
    skills: [],
    interests: [],
    causeAreas: [],
    availability: 'flexible',
    subType: 'student',
    bio: ''
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const loadProfile = async () => {
      setLoading(true);setError('');
      try {
        const response = await communityService.getProfile();
        const profile = response.data.profile || {};
        const user = response.data.user || {};
        setForm({
          name: user.name || '',
          profilePhotoUrl: user.profilePhotoUrl || '',
          location: user.location || { city: '', state: '' },
          skills: profile.skills || [],
          interests: profile.interests || [],
          causeAreas: profile.causeAreas || [],
          availability: profile.availability || 'flexible',
          subType: profile.subType || 'student',
          bio: profile.bio || ''
        });
      } catch (error) {
        setError('Could not load your profile.');
      } finally { setLoading(false); }
    };
  useEffect(() => { loadProfile(); }, []);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        name: form.name,
        profilePhotoUrl: form.profilePhotoUrl,
        location: form.location,
        skills: form.skills,
        interests: form.interests,
        causeAreas: form.causeAreas,
        availability: form.availability,
        subType: form.subType,
        bio: form.bio
      };
      const response = await communityService.updateProfile(payload);
      if (response.data.user) setUser(response.data.user);
      if (response.data.profile) setProfile(response.data.profile);
      setMessage(response.data.message || 'Profile saved successfully.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || error) return <AsyncState loading={loading} error={error} onRetry={loadProfile}/>;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">My profile</p>
          <h1 className="mt-2 text-3xl font-extrabold text-stone-900">Personal details & strengths</h1>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700" htmlFor="ProfilePage-field-1">Name</label>
              <input id="ProfilePage-field-1" value={form.name} onChange={(e) => updateField('name', e.target.value)} className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700" htmlFor="ProfilePage-field-2">Profile photo URL</label>
              <input id="ProfilePage-field-2" value={form.profilePhotoUrl} onChange={(e) => updateField('profilePhotoUrl', e.target.value)} className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700" htmlFor="ProfilePage-field-3">City</label>
              <input id="ProfilePage-field-3" value={form.location.city || ''} onChange={(e) => setForm({ ...form, location: { ...form.location, city: e.target.value } })} className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700" htmlFor="ProfilePage-field-4">State</label>
              <input id="ProfilePage-field-4" value={form.location.state || ''} onChange={(e) => setForm({ ...form, location: { ...form.location, state: e.target.value } })} className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700" htmlFor="ProfilePage-field-5">Subtype</label>
            <select id="ProfilePage-field-5" value={form.subType} onChange={(e) => updateField('subType', e.target.value)} className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm">
              <option value="student">Student</option>
              <option value="working_professional">Working professional</option>
              <option value="general_volunteer">General volunteer</option>
            </select>
          </div>

          <div>
            <SkillsChipInput label="Skills" value={form.skills} onChange={(skills) => updateField('skills', skills)} placeholder="Add a skill" />
          </div>

          <div>
            <SkillsChipInput label="Interests" value={form.interests} onChange={(value) => updateField('interests', value)} placeholder="Add an interest" />
          </div>

          <div>
            <SkillsChipInput label="Cause areas" value={form.causeAreas} onChange={(value) => updateField('causeAreas', value)} placeholder="Add a cause area" />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700" htmlFor="ProfilePage-field-6">Availability</label>
            <select id="ProfilePage-field-6" value={form.availability} onChange={(e) => updateField('availability', e.target.value)} className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm">
              <option value="weekdays">Weekdays</option>
              <option value="weekends">Weekends</option>
              <option value="flexible">Flexible</option>
              <option value="occasional">Occasional</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700" htmlFor="ProfilePage-field-7">Bio</label>
            <textarea id="ProfilePage-field-7" rows={5} value={form.bio} onChange={(e) => updateField('bio', e.target.value)} className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
          </div>

          {message && <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">{message}</div>}

          <button type="submit" disabled={saving} className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60">
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </form>
        {currentUser && <ReportModal targetType="user" targetId={currentUser._id} label="Report profile" />}
      </div>
    </div>
  );
};

export default ProfilePage;
