import React, { useState } from 'react';
import Head from 'next/head';

// Phase 1 Community Reporter Submission Page
// Route: /community-reporter

interface FormState {
  name: string;
  email: string;
  location: string;
  category: string;
  headline: string;
  story: string;
  confirm: boolean;
}

const initialState: FormState = {
  name: '',
  email: '',
  location: '',
  category: '',
  headline: '',
  story: '',
  confirm: false,
};

const categories = [
  'Regional',
  'Youth / Campus',
  'Civic Issue',
  'Lifestyle / Culture',
  'General Tip',
];

const CommunityReporterPage: React.FC = () => {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  const submitUrl = API_BASE ? `${API_BASE}/api/community/submissions` : '/api/community/submissions';

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Name is required.';
    if (!form.email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Enter a valid email.';
    }
    if (!form.category) newErrors.category = 'Select a category.';
    if (!form.headline.trim()) newErrors.headline = 'Headline is required.';
    if (form.headline.length > 150) newErrors.headline = 'Headline exceeds 150 characters.';
    if (!form.story.trim()) {
      newErrors.story = 'Story is required.';
    } else if (form.story.trim().length < 50) {
      newErrors.story = 'Story must be at least 50 characters.';
    }
    if (!form.confirm) newErrors.confirm = 'You must confirm authenticity & policy.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> = (e) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
            email: form.email.trim(),
            location: form.location.trim(),
            category: form.category,
            headline: form.headline.trim(),
            story: form.story.trim(),
        }),
      });
      if (!res.ok) throw new Error('Request failed');
      setForm(initialState);
      setSuccessMessage('Thank you! Your story has been submitted and is under review by the NewsPulse team.');
    } catch (err) {
      setErrorMessage('We couldn’t submit your story. Please try again or check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>Community Reporter | News Pulse</title>
        <meta name="description" content="Submit local stories and tips to News Pulse." />
      </Head>

      {/* Hero / Intro */}
      <section className="relative py-16 px-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            News Pulse Community Reporter
          </h1>
          <p className="text-lg md:text-xl leading-relaxed mb-6 text-gray-700 dark:text-gray-300">
            Share impactful local stories, emerging issues, campus updates, and verified tips. Every submission is manually reviewed by our editorial team before publishing.
          </p>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 mb-4">
            <h2 className="text-xl font-semibold mb-3">Submission Guidelines</h2>
            <ul className="list-disc ml-5 space-y-1 text-sm text-gray-600 dark:text-gray-300">
              <li>No hate speech or discriminatory content.</li>
              <li>No intentionally false or misleading information.</li>
              <li>No personal attacks, harassment, or doxxing.</li>
              <li>Respect privacy & safety; blur sensitive personal data.</li>
              <li>Campus / youth stories must be authentic and respectful.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-2">Submit Your Story</h2>
            {successMessage && (
              <div className="rounded-md bg-green-50 border border-green-200 p-4 text-green-800 text-sm">
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-800 text-sm">
                {errorMessage}
              </div>
            )}

            {/* Name */}
            <div>
              <label htmlFor="name" className="block font-medium mb-1">Name *</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={form.name}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block font-medium mb-1">Email *</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block font-medium mb-1">Location (optional)</label>
              <input
                id="location"
                name="location"
                type="text"
                placeholder="City, State"
                value={form.location}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block font-medium mb-1">Category *</label>
              <select
                id="category"
                name="category"
                required
                value={form.category}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.category && <p className="text-red-600 text-xs mt-1">{errors.category}</p>}
            </div>

            {/* Headline */}
            <div>
              <label htmlFor="headline" className="block font-medium mb-1">Headline *</label>
              <input
                id="headline"
                name="headline"
                type="text"
                required
                maxLength={150}
                value={form.headline}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-gray-500">Max 150 characters</p>
                <p className="text-xs text-gray-500">{form.headline.length}/150</p>
              </div>
              {errors.headline && <p className="text-red-600 text-xs mt-1">{errors.headline}</p>}
            </div>

            {/* Story */}
            <div>
              <label htmlFor="story" className="block font-medium mb-1">Story *</label>
              <textarea
                id="story"
                name="story"
                required
                rows={7}
                value={form.story}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                placeholder="Describe the event, issue, or tip in detail..."
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-gray-500">Minimum 50 characters</p>
                <p className="text-xs text-gray-500">{form.story.trim().length} chars</p>
              </div>
              {errors.story && <p className="text-red-600 text-xs mt-1">{errors.story}</p>}
            </div>

            {/* Confirm */}
            <div className="flex items-start space-x-3">
              <input
                id="confirm"
                name="confirm"
                type="checkbox"
                checked={form.confirm}
                onChange={handleChange}
                className="mt-1 h-5 w-5 rounded border-gray-300 focus:ring-blue-500"
              />
              <label htmlFor="confirm" className="text-sm leading-relaxed">
                I confirm this story is true to the best of my knowledge and I accept the NewsPulse contributor policy.
              </label>
            </div>
            {errors.confirm && <p className="text-red-600 text-xs -mt-4 mb-2">{errors.confirm}</p>}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={submitting}
                className={`w-full font-semibold px-6 py-3 rounded-lg transition-colors ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                {submitting ? 'Submitting…' : 'Submit Story'}
              </button>
            </div>

            <p className="text-xs text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-700">
              Note: Nothing is auto-published. Every submission is reviewed manually for safety, ethics, and accuracy.
            </p>
          </form>
        </div>
      </section>
    </div>
  );
};

export default CommunityReporterPage;
