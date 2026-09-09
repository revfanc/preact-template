import { defineConfig } from 'vite';
import { createWebConfig } from '../../tooling/vite.ts';

export default defineConfig(({ mode }) => createWebConfig(mode, 5174));
