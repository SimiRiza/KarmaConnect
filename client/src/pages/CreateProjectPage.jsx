import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as ngoSvc from '../services/ngoService';
import SkillsChipInput from '../components/SkillsChipInput';
import RepeatableFieldList from '../components/RepeatableFieldList';
import { Plus, Loader2, ArrowLeft } from 'lucide-react';

const CATEGORIES = ['cleaning', 'repair', 'environment', 'education', 'elderly_support', 'animal_welfare', 'health', 'other'];
const CAT_LABEL = {
  cleaning: 'Cleaning', repair: 'Repair', environment: 'Environment',
  education: 'Education', elderly_support: 'Elderly Support',
  animal_welfare: 'Animal Welfare', health: 'Health', other: 'Other',
};

const FIELD = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

const INPUT = (props) => (
  <input
    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition"
    {...props}
  />
);

const SELECT = ({ children, ...props }) => (
  <select
    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition bg-white"
    {...props}
  >
    {children}
  </select>
);

const TEXTAREA = (props) => (
  <textarea
    rows={4}
    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition resize-none"
    {...props}
  />
);

const CreateProjectPage = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    category: '',
    description: '',
    problemStatement: '',
    city: '',
    area: '',
    beneficiariesEstimate: '',
    beneficiariesDescription: '',
    volunteersNeeded: '',
    fundingRequired: '',
    startDate: '',
    expectedEndDate: '',
    requiredSkills: [],
    milestones: [],
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const addMilestone = () =>
    setForm((f) => ({ ...f, milestones: [...f.milestones, { title: '', targetDate: '' }] }));

  const updateMilestone = (idx, field, value) =>
    setForm((f) => ({
      ...f,
      milestones: f.milestones.map((m, i) => (i === idx ? { ...m, [field]: value } : m)),
    }));

  const removeMilestone = (idx) =>
    setForm((f) => ({ ...f, milestones: f.milestones.filter((_, i) => i !== idx) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.category || !form.description || !form.city) {
      setError('Please fill all required fields.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title,
        category: form.category,
        description: form.description,
        problemStatement: form.problemStatement,
        location: { city: form.city, area: form.area },
        beneficiaries: {
          estimatedCount: Number(form.beneficiariesEstimate) || 0,
          description: form.beneficiariesDescription,
        },
        volunteersNeeded: Number(form.volunteersNeeded) || 0,
        fundingRequired: Number(form.fundingRequired) || 0,
        requiredSkills: form.requiredSkills,
        timeline: {
          startDate: form.startDate || null,
          expectedEndDate: form.expectedEndDate || null,
        },
        milestones: form.milestones
          .filter((m) => m.title.trim())
          .map((m) => ({ title: m.title, targetDate: m.targetDate || null })),
      };
      const res = await ngoSvc.createProject(payload);
      navigate(`/ngo/projects/${res.data.project._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create project.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50 transition">
          <ArrowLeft className="w-4 h-4 text-stone-600" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Create New Project</h1>
          <p className="text-sm text-stone-500 mt-0.5">Start a new managed project from scratch</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <FIELD label="Project Title" required>
              <INPUT value={form.title} onChange={set('title')} placeholder="Descriptive project title" />
            </FIELD>
          </div>
          <FIELD label="Category" required>
            <SELECT value={form.category} onChange={set('category')} required>
              <option value="">Select category</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
            </SELECT>
          </FIELD>
          <FIELD label="City" required>
            <INPUT value={form.city} onChange={set('city')} placeholder="e.g. Mumbai" />
          </FIELD>
          <FIELD label="Area / Locality">
            <INPUT value={form.area} onChange={set('area')} placeholder="e.g. Andheri West" />
          </FIELD>
        </div>

        <FIELD label="Problem Statement">
          <TEXTAREA value={form.problemStatement} onChange={set('problemStatement')} placeholder="What problem does this project address?" />
        </FIELD>

        <FIELD label="Project Description" required>
          <TEXTAREA value={form.description} onChange={set('description')} placeholder="Approach, methodology, expected outcomes…" rows={5} />
        </FIELD>

        {/* Beneficiaries */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FIELD label="Estimated Beneficiaries Count">
            <INPUT type="number" min="0" value={form.beneficiariesEstimate} onChange={set('beneficiariesEstimate')} placeholder="0" />
          </FIELD>
          <FIELD label="Beneficiaries Description">
            <INPUT value={form.beneficiariesDescription} onChange={set('beneficiariesDescription')} placeholder="Who benefits and how?" />
          </FIELD>
        </div>

        {/* Resources */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FIELD label="Volunteers Needed">
            <INPUT type="number" min="0" value={form.volunteersNeeded} onChange={set('volunteersNeeded')} placeholder="0" />
          </FIELD>
          <FIELD label="Funding Required (₹)">
            <INPUT type="number" min="0" value={form.fundingRequired} onChange={set('fundingRequired')} placeholder="0" />
          </FIELD>
        </div>

        {/* Skills */}
        <FIELD label="Required Skills">
          <SkillsChipInput
            value={form.requiredSkills}
            onChange={(v) => setForm((f) => ({ ...f, requiredSkills: v }))}
            placeholder="Type a skill and press Enter…"
          />
        </FIELD>

        {/* Timeline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FIELD label="Start Date">
            <INPUT type="date" value={form.startDate} onChange={set('startDate')} />
          </FIELD>
          <FIELD label="Expected End Date">
            <INPUT type="date" value={form.expectedEndDate} onChange={set('expectedEndDate')} />
          </FIELD>
        </div>

        {/* Milestones */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Milestones</label>
            <button type="button" onClick={addMilestone} className="text-xs font-semibold text-brand-700 flex items-center gap-1 hover:text-brand-800">
              <Plus className="w-3.5 h-3.5" /> Add Milestone
            </button>
          </div>
          <div className="space-y-2">
            {form.milestones.map((m, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <INPUT
                  value={m.title}
                  onChange={(e) => updateMilestone(idx, 'title', e.target.value)}
                  placeholder="Milestone title"
                  className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-400 transition"
                />
                <INPUT
                  type="date"
                  value={m.targetDate}
                  onChange={(e) => updateMilestone(idx, 'targetDate', e.target.value)}
                  className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-400 transition"
                />
                <button type="button" onClick={() => removeMilestone(idx)} className="p-2 text-red-400 hover:text-red-600 transition">✕</button>
              </div>
            ))}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition-colors shadow disabled:opacity-70"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {saving ? 'Creating…' : 'Create Project'}
        </button>
      </form>
    </div>
  );
};

export default CreateProjectPage;
