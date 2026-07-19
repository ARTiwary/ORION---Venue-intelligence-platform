const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    files: ['eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { require: 'readonly', module: 'readonly' }
    }
  },
  {
    files: ['server.js', 'lib/**/*.js', 'scripts/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        AbortController: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^(req|res|next)$', caughtErrors: 'none' }],
      'no-console': 'off',
      'eqeqeq': 'error',
      'no-var': 'error',
      'prefer-const': 'error'
    }
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      'eqeqeq': 'error',
      'no-var': 'error',
      'prefer-const': 'error'
    }
  },
  {
    ignores: ['node_modules/**', 'public/config.js']
  }
];
