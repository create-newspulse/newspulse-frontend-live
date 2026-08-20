import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import ReporterPortalLayout from '../../components/reporter-portal/ReporterPortalLayout';
import { PortalRouteState } from '../../components/reporter-portal/PortalRouteState';
import { usePublicFounderToggles } from '../../hooks/usePublicFounderToggles';
import { useReporterPortalSession } from '../../hooks/useReporterPortalSession';
import { getReporterPortalPageServerProps } from '../../lib/reporterPortalPage';
import { loadReporterPortalProfile, saveReporterPortalProfile } from '../../lib/reporterPortal';
import type { FeatureToggleProps } from '../../types/community-reporter';

export default function ReporterProfilePage({ communityReporterClosed, reporterPortalClosed }: FeatureToggleProps) {
  const router = useRouter();
  const { toggles } = usePublicFounderToggles({ communityReporterClosed, reporterPortalClosed, youthPulseSubmissionsClosed: false, updatedAt: null });
  const { session, profile, status, logout, reason } = useReporterPortalSession({ reportUnauthorizedReason: true });
  const isAuthenticated = status === 'authenticated' && Boolean(session?.email);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', whatsapp: '', city: '', district: '', state: '', country: 'India' });
  const [saved, setSaved] = useState(false);
  const currentPath = typeof router.asPath === 'string' && router.asPath.startsWith('/reporter/') ? router.asPath : '/reporter/profile';
  const loginHref = `/reporter/login?next=${encodeURIComponent(currentPath)}`;
  const shouldRedirectToLogin = !toggles.communityReporterClosed && !toggles.reporterPortalClosed && status === 'anonymous';

  useEffect(() => {
    if (!shouldRedirectToLogin) return;
    void router.replace(loginHref).catch(() => {});
  }, [loginHref, router, shouldRedirectToLogin]);

  useEffect(() => {
    const profile = loadReporterPortalProfile();
    setForm({
      fullName: String(profile?.fullName || ''),
      email: String(profile?.email || session?.email || ''),
      phone: String(profile?.phone || ''),
      whatsapp: String(profile?.whatsapp || ''),
      city: String(profile?.city || ''),
      district: String(profile?.district || ''),
      state: String(profile?.state || ''),
      country: String(profile?.country || 'India'),
    });
  }, [session?.email]);

  if (toggles.communityReporterClosed || toggles.reporterPortalClosed) {
    return <ReporterPortalLayout title="Reporter Profile" description="Reporter profile access is blocked by toggle." active="profile"><PortalRouteState title="Reporter Portal is closed" description="The Reporter Portal toggle is off, so profile access is blocked." actionHref="/community-reporter" actionLabel="Back to Community Reporter" /></ReporterPortalLayout>;
  }

  if (status === 'checking') {
    return <ReporterPortalLayout title="Reporter Profile" description="Checking session." active="profile"><div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Checking reporter session…</div></ReporterPortalLayout>;
  }

  if (!isAuthenticated) {
    return <ReporterPortalLayout title="Reporter Profile" description="Redirecting to reporter login." active="profile"><div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Checking reporter session…</div></ReporterPortalLayout>;
  }

  return (
    <ReporterPortalLayout title="Reporter Profile" description="Manage the saved reporter identity used by the portal and the shared community reporter submission flow." active="profile" session={session} profile={profile} onLogout={() => { void logout().finally(() => router.push('/reporter/login').catch(() => {})); }}>
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-black text-slate-950">Reporter Profile</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">These saved details prefill future submissions and keep the portal aligned with the existing community reporter browser storage.</p>

        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={(event) => {
          event.preventDefault();
          saveReporterPortalProfile(form);
          setSaved(true);
          window.setTimeout(() => setSaved(false), 2000);
        }}>
          <div className="md:col-span-2"><label className="mb-1 block text-sm font-semibold text-slate-900">Full name</label><input value={form.fullName} onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-blue-500" /></div>
          <div className="md:col-span-2"><label className="mb-1 block text-sm font-semibold text-slate-900">Email</label><input type="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-blue-500" /></div>
          <div><label className="mb-1 block text-sm font-semibold text-slate-900">Phone (optional)</label><input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-blue-500" /><p className="mt-1 text-xs text-slate-500">Saved here and reused in future reporter submissions.</p></div>
          <div><label className="mb-1 block text-sm font-semibold text-slate-900">WhatsApp (optional)</label><input type="tel" inputMode="tel" autoComplete="tel-national" value={form.whatsapp} onChange={(e) => setForm((current) => ({ ...current, whatsapp: e.target.value }))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-blue-500" /></div>
          <div><label className="mb-1 block text-sm font-semibold text-slate-900">City</label><input value={form.city} onChange={(e) => setForm((current) => ({ ...current, city: e.target.value }))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-blue-500" /></div>
          <div><label className="mb-1 block text-sm font-semibold text-slate-900">District</label><input value={form.district} onChange={(e) => setForm((current) => ({ ...current, district: e.target.value }))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-blue-500" /></div>
          <div><label className="mb-1 block text-sm font-semibold text-slate-900">State</label><input value={form.state} onChange={(e) => setForm((current) => ({ ...current, state: e.target.value }))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-blue-500" /></div>
          <div><label className="mb-1 block text-sm font-semibold text-slate-900">Country</label><input value={form.country} onChange={(e) => setForm((current) => ({ ...current, country: e.target.value }))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-blue-500" /></div>
          <div className="md:col-span-2 flex items-center gap-3">{saved ? <div className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Saved</div> : null}<button type="submit" className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Save profile</button></div>
        </form>
      </div>
    </ReporterPortalLayout>
  );
}

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = getReporterPortalPageServerProps;