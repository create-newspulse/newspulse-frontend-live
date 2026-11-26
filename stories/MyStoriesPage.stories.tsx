import type { Meta, StoryObj } from '@storybook/react';
import { PortalRouteState } from '../components/reporter-portal/PortalRouteState';

const meta = { title: 'Pages/CommunityReporter/MyStories', component: PortalRouteState } satisfies Meta<typeof PortalRouteState>;
export default meta;

export const SignedOut: StoryObj<typeof meta> = {
  args: {
    title: 'My submissions',
    description: 'Sign in to view the submissions linked to your account.',
    actionHref: '/reporter/login?next=%2Freporter%2Fsubmissions',
    actionLabel: 'Reporter sign-in',
  },
};
