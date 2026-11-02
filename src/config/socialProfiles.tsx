import React from 'react';
import { Facebook, Instagram, Youtube } from 'lucide-react';

export type SocialProfile = Readonly<{
  id: string;
  label: string;
  url: `https://${string}`;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  enabled: boolean;
}>;

function XProfileIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932 6.064-6.933Zm-1.29 19.49h2.039L6.487 3.24H4.3l13.31 17.403Z" />
    </svg>
  );
}

export const SOCIAL_PROFILES: readonly SocialProfile[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    url: 'https://www.youtube.com/@NewsPulse-Official',
    icon: Youtube,
    enabled: true,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    url: 'https://www.instagram.com/newspulse.co.in/',
    icon: Instagram,
    enabled: true,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    url: 'https://www.facebook.com/profile.php?id=61594207143478',
    icon: Facebook,
    enabled: true,
  },
  {
    id: 'x',
    label: 'X',
    url: 'https://x.com/newspulse_co_in',
    icon: XProfileIcon,
    enabled: true,
  },
];
