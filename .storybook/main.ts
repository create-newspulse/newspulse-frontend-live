import type { StorybookConfig } from '@storybook/nextjs-vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';
import { fileURLToPath } from 'url';

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-onboarding"
  ],
  "framework": "@storybook/nextjs-vite",
  "staticDirs": [
    "..\\public"
  ],
  viteFinal: async (config) => {
    // Remove default tsconfig-paths to avoid scanning sibling app tsconfigs
    (config as any).plugins = ((config as any).plugins || []).filter((p: any) => {
      const name = String(p?.name || '').toLowerCase();
      const looksLikeTsconfigPaths = name.includes('tsconfig') && name.includes('paths');
      return !looksLikeTsconfigPaths;
    });
    // Add constrained tsconfig-paths pointing only to root tsconfig
    const __dirnamePolyfill = path.dirname(fileURLToPath(import.meta.url));
    const rootTsconfig = path.resolve(__dirnamePolyfill, '../tsconfig.json');
    ((config as any).plugins as any[]).push(tsconfigPaths({ projects: [rootTsconfig], ignoreConfigErrors: true }));
    return config;
  }
};
export default config;