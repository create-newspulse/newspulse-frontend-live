import React, { useState } from 'react';
import Head from 'next/head';
import type { GetStaticProps } from 'next';

type OrgType = 'print' | 'tv' | 'radio' | 'digital' | 'freelance' | 'other';

interface FormState {
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  organisationName: string;
  organisationType: OrgType | '';
  positionTitle: string;
  beats: string[];
  yearsExperience: string; // keep as string for input control
  languages: string[];
  websiteOrPortfolio?: string;
  linkedin?: string;
  twitter?: string;
  consent: boolean;
}

const initialForm: FormState = {
  name: '',
  email: '',
  phone: '',
  city: '',
  state: '',
  country: 'India',
  organisationName: '',
  organisationType: '',
  positionTitle: '',
  beats: [],
  yearsExperience: '',
  languages: [],
  websiteOrPortfolio: '',
  linkedin: '',
  twitter: '',
  consent: false,
};

const BEATS = ['Politics','Crime','Business','Education','Civic','Sports','Entertainment','Tech','Other'];
const LANG_OPTIONS = ['en','hi','gu'];

const JournalistDeskPage: React.FC = () => {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const setField = (name: keyof FormState, value: any) => {
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name as string]) {
      setErrors(prev => { const c = { ...prev }; delete c[name as string]; return c; });
    }
  };

  const toggleArrayValue = (name: keyof FormState, value: string) => {
    setForm(prev => {
      const arr = new Set<string>(prev[name] as string[]);
      if (arr.has(value)) arr.delete(value); else arr.add(value);
      return { ...prev, [name]: Array.from(arr) } as FormState;
    });
  };

  const validate = () => {
    const e: Record<string,string> = {};
    if (!form.name.trim()) e.name = 'Full name is required.';
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email.';
    if (!form.phone.trim()) e.phone = 'Phone is required.';
    if (!form.city.trim()) e.city = 'City is required.';
    if (!form.state.trim()) e.state = 'State is required.';
    if (!form.country.trim()) e.country = 'Country is required.';
    if (!form.organisationName.trim()) e.organisationName = 'Organisation name is required.';
    if (!form.organisationType) e.organisationType = 'Organisation type is required.';
    if (!form.positionTitle.trim()) e.positionTitle = 'Position title is required.';
    if (form.beats.length === 0) e.beats = 'Select at least one beat.';
    if (form.yearsExperience && isNaN(Number(form.yearsExperience))) e.yearsExperience = 'Enter a valid number.';
    if (!form.consent) e.consent = 'Consent is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (ev) => {
    ev.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        organisationName: form.organisationName.trim(),
        organisationType: (form.organisationType || 'other') as OrgType,
        positionTitle: form.positionTitle.trim(),
        beats: form.beats,
        yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : undefined,
        languages: form.languages,
        websiteOrPortfolio: form.websiteOrPortfolio?.trim() || undefined,
        socialLinks: {
          linkedin: form.linkedin?.trim() || undefined,
          twitter: form.twitter?.trim() || undefined,
        }
      };

      const res = await fetch('/api/journalists/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      let data: any = null;
      try { data = await res.json(); } catch {}
      if (res.ok && data?.success !== false) {
        setSuccessMessage(data?.message || 'Thank you. Your application is now pending verification.');
        setForm(initialForm);
      } else {
        setErrorMessage(data?.message || data?.error || 'Submission failed. Please try again later.');
      }
    } catch (err) {
      setErrorMessage('Network error. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>Journalist Desk – Join the News Pulse Network</title>
        <meta name="description" content="Apply to join the News Pulse network as a professional journalist or media partner." />
      </Head>

      <section className="relative py-16 px-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            Journalist Desk – Join the News Pulse Network
          </h1>
          <p className="text-lg md:text-xl leading-relaxed mb-6 text-gray-700 dark:text-gray-300">
            If you are a professional journalist, the easiest way is to use the Community Reporter form and choose ‘Professional Journalist’. This page is an optional network registration.
          </p>
        </div>
      </section>

      <section className="py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
            {successMessage && (
              <div className="rounded-md bg-green-50 border border-green-200 p-4 text-green-800 text-sm">{successMessage}</div>
            )}
            {errorMessage && (
              <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-800 text-sm">{errorMessage}</div>
            )}

            <h2 className="text-2xl font-bold">Contact info</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block font-medium mb-1" htmlFor="name">Full name *</label>
                <input id="name" type="text" value={form.name} onChange={e => setField('name', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block font-medium mb-1" htmlFor="email">Email *</label>
                <input id="email" type="email" value={form.email} onChange={e => setField('email', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block font-medium mb-1" htmlFor="phone">Phone *</label>
                <input id="phone" type="tel" value={form.phone} onChange={e => setField('phone', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone}</p>}
                <p className="text-xs text-gray-500 mt-1">For verification only, never shown publicly.</p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="block font-medium mb-1" htmlFor="city">City *</label>
                <input id="city" type="text" value={form.city} onChange={e => setField('city', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                {errors.city && <p className="text-red-600 text-xs mt-1">{errors.city}</p>}
              </div>
              <div>
                <label className="block font-medium mb-1" htmlFor="state">State *</label>
                <input id="state" type="text" value={form.state} onChange={e => setField('state', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                {errors.state && <p className="text-red-600 text-xs mt-1">{errors.state}</p>}
              </div>
              <div>
                <label className="block font-medium mb-1" htmlFor="country">Country *</label>
                <input id="country" type="text" value={form.country} onChange={e => setField('country', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                {errors.country && <p className="text-red-600 text-xs mt-1">{errors.country}</p>}
              </div>
            </div>

            <h2 className="text-2xl font-bold">Professional info</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block font-medium mb-1" htmlFor="organisationName">Organisation name *</label>
                <input id="organisationName" type="text" value={form.organisationName} onChange={e => setField('organisationName', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                {errors.organisationName && <p className="text-red-600 text-xs mt-1">{errors.organisationName}</p>}
              </div>
              <div>
                <label className="block font-medium mb-1" htmlFor="organisationType">Organisation type *</label>
                <select id="organisationType" value={form.organisationType} onChange={e => setField('organisationType', e.target.value as OrgType)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2">
                  <option value="">Select type</option>
                  <option value="print">Print</option>
                  <option value="tv">TV</option>
                  <option value="radio">Radio</option>
                  <option value="digital">Digital</option>
                  <option value="freelance">Freelance</option>
                  <option value="other">Other</option>
                </select>
                {errors.organisationType && <p className="text-red-600 text-xs mt-1">{errors.organisationType}</p>}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block font-medium mb-1" htmlFor="positionTitle">Position title *</label>
                <input id="positionTitle" type="text" value={form.positionTitle} onChange={e => setField('positionTitle', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                {errors.positionTitle && <p className="text-red-600 text-xs mt-1">{errors.positionTitle}</p>}
              </div>
              <div>
                <label className="block font-medium mb-1" htmlFor="yearsExperience">Years of experience</label>
                <input id="yearsExperience" type="number" min="0" value={form.yearsExperience} onChange={e => setField('yearsExperience', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                {errors.yearsExperience && <p className="text-red-600 text-xs mt-1">{errors.yearsExperience}</p>}
              </div>
            </div>

            <div>
              <label className="block font-medium mb-2">Beats *</label>
              <div className="flex flex-wrap gap-2">
                {BEATS.map(beat => (
                  <button type="button" key={beat} onClick={() => toggleArrayValue('beats', beat)} className={`px-3 py-1 rounded-full border ${form.beats.includes(beat) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}>{beat}</button>
                ))}
              </div>
              {errors.beats && <p className="text-red-600 text-xs mt-1">{errors.beats}</p>}
            </div>

            <div>
              <label className="block font-medium mb-2">Primary languages</label>
              <div className="flex flex-wrap gap-2">
                {LANG_OPTIONS.map(code => (
                  <button type="button" key={code} onClick={() => toggleArrayValue('languages', code)} className={`px-3 py-1 rounded-full border ${form.languages.includes(code) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}>{code}</button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Select one or more. You can also type additional languages as comma-separated:</p>
              <input type="text" placeholder="e.g., en, hi, gu" value={form.languages.filter(l => !LANG_OPTIONS.includes(l)).join(', ')} onChange={e => setField('languages', Array.from(new Set([...form.languages.filter(l => LANG_OPTIONS.includes(l)), ...e.target.value.split(',').map(s => s.trim()).filter(Boolean)])))} className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
            </div>

            <h2 className="text-2xl font-bold">Links (optional)</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block font-medium mb-1" htmlFor="websiteOrPortfolio">Organisation website / portfolio</label>
                <input id="websiteOrPortfolio" type="url" value={form.websiteOrPortfolio} onChange={e => setField('websiteOrPortfolio', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
              </div>
              <div>
                <label className="block font-medium mb-1" htmlFor="linkedin">LinkedIn profile</label>
                <input id="linkedin" type="url" value={form.linkedin} onChange={e => setField('linkedin', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
              </div>
              <div>
                <label className="block font-medium mb-1" htmlFor="twitter">Twitter / X profile</label>
                <input id="twitter" type="url" value={form.twitter} onChange={e => setField('twitter', e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input id="consent" type="checkbox" checked={form.consent} onChange={e => setField('consent', e.target.checked)} className="mt-1 h-5 w-5 rounded border-gray-300 focus:ring-blue-500" />
              <label htmlFor="consent" className="text-sm leading-relaxed">I work professionally in media and accept the News Pulse Contributor Policy and Privacy Policy.</label>
            </div>
            {errors.consent && <p className="text-red-600 text-xs -mt-4 mb-2">{errors.consent}</p>}

            <div>
              <button type="submit" disabled={submitting} className={`w-full font-semibold px-6 py-3 rounded-lg transition-colors ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}>
                {submitting ? 'Submitting…' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};

export default JournalistDeskPage;

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const { getMessages } = await import('../lib/getMessages');
  return {
    props: {
      messages: await getMessages(locale as string),
    },
  };
};
