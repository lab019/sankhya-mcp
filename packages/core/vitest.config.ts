import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Permite que imports `./x.js` (exigidos pelo NodeNext) resolvam para `./x.ts`.
    extensionAlias: { '.js': ['.ts', '.js'] },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
