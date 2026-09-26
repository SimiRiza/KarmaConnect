import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as communityService from '../services/communityService';
import PhotoUploadPreview from '../components/PhotoUploadPreview';

const categories = ['cleaning', 'repair', 'environment', 'education', 'elderly_support', 'animal_welfare', 'health', 'other'];

const PostProblemPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'education',
    city: '',
    area: '',
    urgency: 'medium',
    estimatedResourcesNeeded: ''
  });
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const nextErrors = {};
    if (!form.title.trim()) nextErrors.title = 'Title is required.';
    if (form.title.length > 100) nextErrors.title = 'Title cannot exceed 100 characters.';
    if (!form.description.trim()) nextErrors.description = 'Description is required.';
    if (form.description.length > 1000) nextErrors.description = 'Description cannot exceed 1000 characters.';
    if (!form.city.trim()) nextErrors.city = 'City is required.';
    if (!form.urgency) nextErrors.urgency = 'Urgency is required.';
    if (photos.length === 0) nextErrors.photos = 'At least one photo is required.';
    if (!categories.includes(form.category)) nextErrors.category = 'Please choose a valid category.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const imageUrls = [];
      if (photos.some((file) => typeof file !== 'string')) {
        const formData = new FormData();
        photos.filter((file) => typeof file !== 'string').forEach((file) => formData.append('photos', file));
        const uploadRes = await communityService.uploadProblemPhotos(formData);
        imageUrls.push(...(uploadRes.data.urls || []));
      }
      const existingUrls = photos.filter((file) => typeof file === 'string');
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        photos: [...existingUrls, ...imageUrls],
        location: {
          city: form.city,
          area: form.area,
          coordinates: [0, 0]
        },
        urgency: form.urgency,
        estimatedResourcesNeeded: form.estimatedResourcesNeeded
      };

      const response = await communityService.createProblem(payload);
      navigate(`/problems/${response.data.problem._id}`);
    } catch (error) {
      setErrors({ submit: error.response?.data?.message || 'Unable to create problem. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Report a local problem</p>
          <h1 className="mt-2 text-3xl font-extrabold text-stone-900">Post a problem</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700" htmlFor="PostProblemPage-field-1">Title</label>
            <input id="PostProblemPage-field-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
            {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700" htmlFor="PostProblemPage-field-2">Description</label>
            <textarea id="PostProblemPage-field-2" rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
            {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700" htmlFor="PostProblemPage-field-3">Category</label>
              <select id="PostProblemPage-field-3" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm">
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700">Urgency</label>
              <div className="flex gap-2 pt-2">
                {['low', 'medium', 'high'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm({ ...form, urgency: value })}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold capitalize ${form.urgency === value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-stone-300 text-stone-700'}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              {errors.urgency && <p className="mt-1 text-xs text-red-600">{errors.urgency}</p>}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700" htmlFor="PostProblemPage-field-4">City</label>
              <input id="PostProblemPage-field-4" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
              {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city}</p>}
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700" htmlFor="PostProblemPage-field-5">Area / Neighborhood</label>
              <input id="PostProblemPage-field-5" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
            </div>
          </div>

          <div>
            <PhotoUploadPreview files={photos} onFilesChange={setPhotos} maxFiles={6} />
            {errors.photos && <p className="mt-1 text-xs text-red-600">{errors.photos}</p>}
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-700" htmlFor="PostProblemPage-field-6">Estimated resources needed</label>
            <textarea id="PostProblemPage-field-6" rows={3} value={form.estimatedResourcesNeeded} onChange={(e) => setForm({ ...form, estimatedResourcesNeeded: e.target.value })} className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
          </div>

          {errors.submit && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.submit}</div>}

          <button type="submit" disabled={submitting} className="w-full rounded-xl bg-accent-500 px-4 py-3 text-sm font-bold text-white hover:bg-accent-600 disabled:opacity-60">
            {submitting ? 'Posting problem…' : 'Submit problem'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PostProblemPage;
