// Flat ESLint config (ESLint v9) compartilhado por todo o monorepo.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Erros de tipo `any` são warning para não travar o stub inicial,
      // mas devem ser eliminados conforme o código amadurece.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Nunca usar console diretamente para dados — apenas stderr para diagnóstico.
      'no-console': 'off',
    },
  },
  prettier,
);
