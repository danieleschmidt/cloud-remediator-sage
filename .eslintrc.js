module.exports = {
  root: true,
  env: {
    browser: false,
    es2021: true,
    node: true,
    jest: true,
    commonjs: true
  },
  extends: [
    'eslint:recommended'
  ],
  plugins: [
    'security',
    'node'
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
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
    
    // Security rules  
    'security/detect-unsafe-regex': 'warn',
    'security/detect-eval-with-expression': 'error',
    'security/detect-non-literal-fs-filename': 'off',
    'security/detect-child-process': 'off',
    'security/detect-object-injection': 'off',
    
    // Disable problematic rules
    'no-template-curly-in-string': 'off',
    'require-jsdoc': 'off',
    'valid-jsdoc': 'off',
    'no-sync': 'off',
    'no-await-in-loop': 'off'
  },

  // ===================================================================
  // ENVIRONMENT-SPECIFIC OVERRIDES
  // ===================================================================
  overrides: [
    {
      // Test files
      files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js'],
      env: {
        jest: true
      },
      rules: {
        'no-console': 'off',
        'security/detect-non-literal-fs-filename': 'off',
        'security/detect-child-process': 'off',
        'node/no-unpublished-require': 'off',
        'require-jsdoc': 'off'
      }
    },
    {
      // Configuration files
      files: [
        '.eslintrc.js',
        'jest.config.js',
        'prettier.config.js',
        '*.config.js'
      ],
      env: {
        node: true
      },
      rules: {
        'no-console': 'off',
        'require-jsdoc': 'off'
      }
    },
    {
      // Lambda function files
      files: ['src/lambda/**/*.js'],
      rules: {
        'no-console': 'off', // CloudWatch logging
        'prefer-destructuring': 'off', // Lambda event structure
        'security/detect-object-injection': 'off' // Common in Lambda events
      }
    },
    {
      // Serverless configuration
      files: ['serverless.yml', 'serverless.yaml'],
      parser: 'yaml-eslint-parser',
      rules: {
        // YAML-specific rules would go here
      }
    }
  ],

  // ===================================================================
  // GLOBALS
  // ===================================================================
  globals: {
    // AWS Lambda globals
    'AWS': 'readonly',
    'console': 'readonly',
    'Buffer': 'readonly',
    'process': 'readonly',
    'global': 'readonly',
    '__dirname': 'readonly',
    '__filename': 'readonly',
    'module': 'readonly',
    'require': 'readonly',
    'exports': 'readonly'
  },

  // ===================================================================
  // IGNORE PATTERNS
  // ===================================================================
  ignorePatterns: [
    'node_modules/',
    'coverage/',
    'dist/',
    'build/',
    '.serverless/',
    '.aws-sam/',
    '.terraform/',
    '*.min.js',
    'package-lock.json',
    'yarn.lock'
  ]
};