const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        setImmediate: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        clearImmediate: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Intl: 'readonly',
        // Jest globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly'
      }
    },
    rules: {
      // Basic quality rules
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-eval': 'error',
      'eqeqeq': 'warn',
      'curly': 'off',
      'no-trailing-spaces': 'off',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      
      // Disable problematic rules
      'no-template-curly-in-string': 'off',
      'require-jsdoc': 'off',
      'valid-jsdoc': 'off',
      'no-sync': 'off',
      'no-await-in-loop': 'off'
    },
    ignores: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      '.serverless/**',
      '.aws-sam/**',
      '.terraform/**',
      '*.min.js',
      'package-lock.json',
      'yarn.lock'
    ]
  },
  // Test files configuration
  {
    files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js'],
    rules: {
      'no-console': 'off',
      'require-jsdoc': 'off'
    }
  },
  // Configuration files
  {
    files: ['.eslintrc.js', 'jest.config.js', 'prettier.config.js', '*.config.js'],
    rules: {
      'no-console': 'off',
      'require-jsdoc': 'off'
    }
  },
  // Lambda function files
  {
    files: ['src/lambda/**/*.js'],
    rules: {
      'no-console': 'off',
      'prefer-destructuring': 'off'
    }
  }
];