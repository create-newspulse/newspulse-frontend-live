import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import MyStoriesPage from '../pages/community-reporter/my-stories';
import { CommunityStoriesProvider } from '../hooks/useCommunityStories';

const meta: Meta<typeof MyStoriesPage> = {
  title: 'Pages/CommunityReporter/MyStories',
  component: MyStoriesPage,
};
export default meta;

type Story = StoryObj<typeof MyStoriesPage>;

const mockValue = {
  settings: { communityReporterEnabled: true, allowNewSubmissions: true, allowMyStoriesPortal: true, allowJournalistApplications: false },
  settingsLoading: false,
  settingsError: null,
  reporterEmail: 'demo@example.com',
  stories: [
    { id: '1', headline: 'Potholes in main street', category: 'Civic', status: 'pending', createdAt: new Date().toISOString(), city: 'Ahmedabad', state: 'GJ' },
    { id: '2', headline: 'Local school fundraiser', category: 'Community', status: 'approved', createdAt: new Date().toISOString(), city: 'Surat', state: 'GJ' },
  ],
  counts: { total: 2, pending: 1, approved: 1, rejected: 0, withdrawn: 0 },
  isLoading: false,
  error: null,
  hasLoadedOnce: true,
  loadingId: null,
  loadStories: async () => {},
  withdraw: async () => true,
};

export const Default: Story = {
  render: (args) => (
    <CommunityStoriesProvider value={mockValue}>
      <MyStoriesPage communityReporterClosed={false} reporterPortalClosed={false} {...args} />
    </CommunityStoriesProvider>
  ),
};

export const Loading: Story = {
  render: (args) => (
    <CommunityStoriesProvider value={{
      ...mockValue,
      settingsLoading: true,
      stories: [],
      isLoading: true,
      hasLoadedOnce: false,
    }}>
      <MyStoriesPage communityReporterClosed={false} reporterPortalClosed={false} {...args} />
    </CommunityStoriesProvider>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <CommunityStoriesProvider value={{
      ...mockValue,
      stories: [],
      counts: { total: 0, pending: 0, approved: 0, rejected: 0, withdrawn: 0 },
      hasLoadedOnce: true,
    }}>
      <MyStoriesPage communityReporterClosed={false} reporterPortalClosed={false} {...args} />
    </CommunityStoriesProvider>
  ),
};

export const ErrorState: Story = {
  render: (args) => (
    <CommunityStoriesProvider value={{
      ...mockValue,
      error: "Couldn't load your stories right now.",
      stories: [],
      counts: { total: 0, pending: 0, approved: 0, rejected: 0, withdrawn: 0 },
      hasLoadedOnce: true,
    }}>
      <MyStoriesPage communityReporterClosed={false} reporterPortalClosed={false} {...args} />
    </CommunityStoriesProvider>
  ),
};
