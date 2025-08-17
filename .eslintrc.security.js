// Security-focused ESLint configuration for CI/CD pipeline
// Standalone configuration with security-focused rules
module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        console: 'readonly',
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
    plugins: {
      security: require('eslint-plugin-security')
    },
    rules: {
      // Enhanced security rules for CI/CD
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error', 
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-non-literal-require': 'error',
      'security/detect-object-injection': 'error',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'error',
      
      // Additional strict rules for production code
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'strict': ['error', 'global'],
      
      // Prevent common injection vulnerabilities
      'no-multi-str': 'error',
      'no-octal-escape': 'error',
      'no-process-env': 'warn',
      'no-process-exit': 'error'
    },
    ignores: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      '.serverless/**',
      '*.min.js'
    ]
  },
  // Test files - relaxed security for testing
  {
    files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-child-process': 'off',
      'security/detect-object-injection': 'off',
      'no-process-env': 'off'
    }
  },
  // Configuration files
  {
    files: ['*.config.js', '.eslintrc.js'],
    rules: {
      'security/detect-non-literal-require': 'off',
      'no-process-env': 'off'
    }
  }
];