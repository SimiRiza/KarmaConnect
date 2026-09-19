import React, { useState } from 'react';
import SkillsChipInput from './SkillsChipInput';
import RepeatableFieldList from './RepeatableFieldList';
export const CATEGORIES = ['cleaning', 'repair', 'environment', 'education', 'elderly_support', 'animal_welfare', 'health', 'other'];
export const Field = ({
  label,
  children
}) => <label className="block space-y-1"><span className="font-medium text-stone-700">{label}</span>{children}</label>;
export const inputClass = 'w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base focus:ring-2 focus:ring-brand-300';
const date = value => value ? String(value).slice(0, 10) : '';
export default function ProjectForm({
  initial = {},
  onSave,
  busy,
  submitLabel = 'Save project'
}) {
  const [form, setForm] = useState(() => ({
    title: initial.title || '',
    problemStatement: initial.problemStatement || initial.description || '',
    description: initial.description || '',
    category: initial.category || 'other',
    location: {
      city: initial.location?.city || '',
      area: initial.location?.area || '',
      ...(initial.location?.coordinates ? {
        coordinates: initial.location.coordinates
      } : {})
    },
    beneficiaries: initial.beneficiaries || {
      estimatedCount: 0,
      description: ''
    },
    requiredSkills: initial.requiredSkills || [],
    volunteersNeeded: initial.volunteersNeeded || 0,
    materialsNeeded: initial.materialsNeeded || [],
    fundingRequired: initial.fundingRequired || 0,
    volunteerHours: initial.volunteerHours || 0,
    timeline: {
      startDate: date(initial.timeline?.startDate),
      expectedEndDate: date(initial.timeline?.expectedEndDate)
    },
    milestones: (initial.milestones || []).map(m => ({
      ...m,
      targetDate: date(m.targetDate)
    }))
  }));
  const set = (key, value) => setForm(f => ({
    ...f,
    [key]: value
  }));
  const nested = (key, field, value) => setForm(f => ({
    ...f,
    [key]: {
      ...f[key],
      [field]: value
    }
  }));
  const text = (key, label, required = false, maxLength) => <Field label={label}><input className={inputClass} required={required} maxLength={maxLength} value={form[key]} onChange={e => set(key, e.target.value)} /></Field>;
  return <form className="space-y-5" onSubmit={e => {
    e.preventDefault();
    onSave({
      ...form,
      timeline: {
        startDate: form.timeline.startDate || null,
        expectedEndDate: form.timeline.expectedEndDate || null
      },
      milestones: form.milestones.map(m => ({
        ...m,
        targetDate: m.targetDate || null
      }))
    });
  }}>
    {text('title', 'Title', true, 120)}
    <Field label="Problem statement"><textarea className={inputClass} maxLength={1500} value={form.problemStatement} onChange={e => set('problemStatement', e.target.value)} /></Field>
    <Field label="Description"><textarea className={inputClass} required maxLength={2500} rows={4} value={form.description} onChange={e => set('description', e.target.value)} /></Field>
    <Field label="Category"><select className={inputClass} value={form.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>)}</select></Field>
    <div className="grid sm:grid-cols-2 gap-4">{['city', 'area'].map(key => <Field key={key} label={key === 'city' ? 'City' : 'Area'}><input className={inputClass} required={key === 'city'} value={form.location[key]} onChange={e => nested('location', key, e.target.value)} /></Field>)}</div>
    <div className="grid sm:grid-cols-2 gap-4"><Field label="Estimated beneficiaries"><input className={inputClass} type="number" min="0" step="1" required value={form.beneficiaries.estimatedCount} onChange={e => nested('beneficiaries', 'estimatedCount', Number(e.target.value))} /></Field><Field label="Who benefits?"><input className={inputClass} value={form.beneficiaries.description} onChange={e => nested('beneficiaries', 'description', e.target.value)} /></Field></div>
    <SkillsChipInput label="Required skills" value={form.requiredSkills} onChange={v => set('requiredSkills', v)} />
    <div className="grid sm:grid-cols-3 gap-4">{[['volunteersNeeded', 'Volunteers needed'], ['fundingRequired', 'Funding required (INR)'], ['volunteerHours', 'Recorded volunteer hours']].map(([key, label]) => <Field key={key} label={label}><input className={inputClass} type="number" min="0" step={key === 'volunteersNeeded' ? '1' : '0.01'} required value={form[key]} onChange={e => set(key, Number(e.target.value))} /></Field>)}</div>
    <p className="text-sm text-stone-500">Record actual hours contributed. These count toward your impact when the project is completed.</p>
    <fieldset className="space-y-2"><legend className="font-semibold">Materials needed</legend><RepeatableFieldList items={form.materialsNeeded} onChange={v => set('materialsNeeded', v)} addLabel="Add material" createItem={() => ({
        item: '',
        quantityNeeded: 1,
        quantityReceived: 0
      })} renderRow={(m, i, change) => <div className="grid sm:grid-cols-2 gap-2 flex-1"><Field label={`Material ${i + 1}`}><input required className={inputClass} value={m.item} onChange={e => change({
            ...m,
            item: e.target.value
          })} /></Field><Field label="Quantity needed"><input required type="number" min="1" step="any" className={inputClass} value={m.quantityNeeded} onChange={e => change({
            ...m,
            quantityNeeded: Number(e.target.value)
          })} /></Field></div>} /></fieldset>
    <div className="grid sm:grid-cols-2 gap-4">{[['startDate', 'Start date'], ['expectedEndDate', 'Expected end date']].map(([key, label]) => <Field key={key} label={label}><input className={inputClass} type="date" min={key === 'expectedEndDate' ? form.timeline.startDate : undefined} value={form.timeline[key]} onChange={e => nested('timeline', key, e.target.value)} /></Field>)}</div>
    <fieldset className="space-y-2"><legend className="font-semibold">Milestones</legend><RepeatableFieldList items={form.milestones} onChange={v => set('milestones', v)} addLabel="Add milestone" createItem={() => ({
        title: '',
        targetDate: '',
        completed: false
      })} renderRow={(m, i, change) => <div className="grid sm:grid-cols-3 gap-2 flex-1"><Field label={`Milestone ${i + 1}`}><input required className={inputClass} value={m.title} onChange={e => change({
            ...m,
            title: e.target.value
          })} /></Field><Field label="Target date"><input type="date" className={inputClass} value={m.targetDate} onChange={e => change({
            ...m,
            targetDate: e.target.value
          })} /></Field><label className="flex gap-2 items-center"><input type="checkbox" checked={m.completed} onChange={e => change({
            ...m,
            completed: e.target.checked
          })} /> Completed</label></div>} /></fieldset>
    <button disabled={busy} className="rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-semibold px-5 py-3 disabled:opacity-50">{busy ? 'Saving...' : submitLabel}</button>
  </form>;
}
