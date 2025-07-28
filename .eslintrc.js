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
    'eslint:recommended',
    'plugin:security/recommended',
    'plugin:node/recommended',
    'plugin:jest/recommended'
  ],
  plugins: [
    'security',
    'node',
    'jest'
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  rules: {
    // ===================================================================
    // GENERAL CODE QUALITY
    // ===================================================================
    'no-unused-vars': ['error', { 
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_',
      'caughtErrorsIgnorePattern': '^_'
    }],
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'no-useless-concat': 'error',
    'no-useless-escape': 'error',
    'no-duplicate-imports': 'error',
    'no-shadow': 'error',
    'no-undef-init': 'error',
    'init-declarations': ['error', 'always'],
    'consistent-return': 'error',
    'default-case': 'error',
    'default-case-last': 'error',
    'no-fallthrough': 'error',
    'no-multi-spaces': 'error',
    'no-multiple-empty-lines': ['error', { 'max': 2, 'maxEOF': 1 }],
    'no-trailing-spaces': 'error',
    'semi': ['error', 'always'],
    'semi-spacing': 'error',
    'quotes': ['error', 'single', { 'avoidEscape': true }],
    'comma-dangle': ['error', 'es5'],
    'comma-spacing': 'error',
    'comma-style': 'error',
    'brace-style': ['error', '1tbs', { 'allowSingleLine': true }],
    'indent': ['error', 2, { 'SwitchCase': 1 }],
    'key-spacing': 'error',
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'space-before-blocks': 'error',
    'space-before-function-paren': ['error', {
      'anonymous': 'always',
      'named': 'never',
      'asyncArrow': 'always'
    }],
    'space-infix-ops': 'error',
    'space-unary-ops': 'error',
    'keyword-spacing': 'error',

    // ===================================================================
    // SECURITY RULES
    // ===================================================================
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-non-literal-require': 'warn',
    'security/detect-object-injection': 'warn',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-bidi-characters': 'error',

    // Additional security-focused rules
    'no-new-require': 'error',
    'no-path-concat': 'error',
    'no-process-exit': 'error',
    'no-sync': 'warn',
    'handle-callback-err': 'error',
    'no-mixed-requires': 'error',
    'no-new-require': 'error',

    // ===================================================================
    // NODE.JS SPECIFIC RULES
    // ===================================================================
    'node/no-unsupported-features/es-syntax': 'off', // Allow ES modules
    'node/no-missing-import': 'off', // Handled by bundler
    'node/no-unpublished-import': 'off', // Allow dev dependencies
    'node/no-unpublished-require': 'off', // Allow dev dependencies
    'node/prefer-global/buffer': ['error', 'always'],
    'node/prefer-global/console': ['error', 'always'],
    'node/prefer-global/process': ['error', 'always'],
    'node/prefer-global/url-search-params': ['error', 'always'],
    'node/prefer-global/url': ['error', 'always'],
    'node/prefer-promises/dns': 'error',
    'node/prefer-promises/fs': 'error',
    'node/no-deprecated-api': 'error',
    'node/exports-style': ['error', 'module.exports'],
    'node/file-extension-in-import': ['error', 'always', {
      '.js': 'never',
      '.json': 'never',
      '.node': 'never'
    }],
    'node/prefer-global/buffer': ['error', 'always'],
    'node/no-mixed-requires': 'error',
    'node/no-new-require': 'error',
    'node/no-path-concat': 'error',

    // ===================================================================
    // JEST/TESTING RULES
    // ===================================================================
    'jest/expect-expect': 'error',
    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/prefer-to-have-length': 'error',
    'jest/valid-expect': 'error',
    'jest/no-deprecated-functions': 'error',
    'jest/prefer-strict-equal': 'error',
    'jest/prefer-to-be': 'error',
    'jest/prefer-to-contain': 'error',
    'jest/prefer-to-be-null': 'error',
    'jest/prefer-to-be-undefined': 'error',

    // ===================================================================
    // AWS/CLOUD SPECIFIC RULES
    // ===================================================================
    'no-template-curly-in-string': 'error', // Prevent template injection
    'prefer-destructuring': ['error', {
      'array': false,
      'object': true
    }, {
      'enforceForRenamedProperties': false
    }],

    // ===================================================================
    // ERROR HANDLING
    // ===================================================================
    'prefer-promise-reject-errors': 'error',
    'no-return-await': 'error',
    'require-atomic-updates': 'error',
    'no-async-promise-executor': 'error',
    'no-await-in-loop': 'warn',
    'no-promise-executor-return': 'error',

    // ===================================================================
    // PERFORMANCE
    // ===================================================================
    'no-await-in-loop': 'warn',
    'prefer-spread': 'error',
    'prefer-rest-params': 'error',
    'no-useless-call': 'error',
    'no-useless-return': 'error',

    // ===================================================================
    // DOCUMENTATION
    // ===================================================================
    'valid-jsdoc': ['warn', {
      'requireReturn': false,
      'requireReturnDescription': false,
      'requireParamDescription': false
    }],
    'require-jsdoc': ['warn', {
      'require': {
        'FunctionDeclaration': true,
        'MethodDefinition': true,
        'ClassDeclaration': true,
        'ArrowFunctionExpression': false,
        'FunctionExpression': false
      }
    }]
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