module.exports = {
  extends: [
    './.eslintrc.js',
    'plugin:security/recommended'
  ],
  
  plugins: [
    'security',
    'no-secrets'
  ],
  
  rules: {
    // ===================================================================
    // SECURITY-SPECIFIC RULES
    // ===================================================================
    
    // Prevent potential security vulnerabilities
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
    'security/detect-unsafe-regex': 'error',
    
    // Secret detection
    'no-secrets/no-secrets': ['error', {
      'tolerance': 4.2,
      'ignoreContent': [
        'example',
        'test',
        'mock',
        'dummy',
        'fake',
        'sample',
        'template',
        'placeholder'
      ],
      'ignoreIdentifiers': [
        'testKey',
        'mockToken',
        'exampleSecret',
        'dummyPassword'
      ]
    }],
    
    // ===================================================================
    // AWS & CLOUD SECURITY
    // ===================================================================
    
    // Custom rules for AWS SDK usage
    'no-console': ['warn', { 
      allow: ['warn', 'error', 'info'] 
    }],
    
    // Prevent hardcoded credentials
    'no-template-curly-in-string': 'error',
    
    // ===================================================================
    // GENERAL SECURITY HARDENING
    // ===================================================================
    
    // Prevent prototype pollution
    'no-prototype-builtins': 'error',
    
    // Prevent eval and Function constructor usage
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // Prevent with statements
    'no-with': 'error',
    
    // Require strict mode
    'strict': ['error', 'global'],
    
    // Prevent global variable leaks
    'no-implicit-globals': 'error',
    
    // Require proper error handling
    'handle-callback-err': 'error',
    'no-throw-literal': 'error',
    
    // File system security
    'no-restricted-modules': ['error', {
      'patterns': [
        'child_process',
        'fs',
        'path'
      ],
      'message': 'Direct file system access should be carefully reviewed for security implications'
    }],
    
    // HTTP security
    'no-restricted-globals': ['error', {
      'name': 'fetch',
      'message': 'Use secure HTTP client libraries with proper validation'
    }],
    
    // ===================================================================
    // SERVERLESS & LAMBDA SPECIFIC
    // ===================================================================
    
    // Environment variable handling
    'no-process-env': 'warn',
    'no-process-exit': 'error',
    
    // Async/await best practices for Lambda
    'require-await': 'warn',
    'no-async-promise-executor': 'error',
    
    // ===================================================================
    // DATA VALIDATION & SANITIZATION
    // ===================================================================
    
    // Require input validation
    'no-unused-vars': ['error', { 
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_'
    }],
    
    // Type checking
    'valid-typeof': 'error',
    'no-undef': 'error'
  },
  
  // ===================================================================
  // ENVIRONMENT-SPECIFIC SETTINGS
  // ===================================================================
  
  env: {
    node: true,
    es6: true,
    jest: true
  },
  
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  
  // ===================================================================
  // OVERRIDES FOR SPECIFIC FILE TYPES
  // ===================================================================
  
  overrides: [
    {
      // Lambda function specific rules
      files: ['src/lambda/**/*.js'],
      rules: {
        'security/detect-child-process': 'error',
        'no-process-exit': 'off', // Lambda functions may need to exit
        'no-console': 'off' // CloudWatch logging
      }
    },
    
    {
      // Test files - relaxed security rules
      files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
      rules: {
        'security/detect-non-literal-fs-filename': 'off',
        'security/detect-child-process': 'off',
        'no-secrets/no-secrets': 'off'
      }
    },
    
    {
      // Configuration files
      files: ['*.config.js', 'scripts/**/*.js'],
      rules: {
        'security/detect-child-process': 'warn',
        'no-process-exit': 'off'
      }
    }
  ],
  
  // ===================================================================
  // IGNORED PATTERNS
  // ===================================================================
  
  ignorePatterns: [
    'node_modules/',
    'coverage/',
    'dist/',
    'build/',
    '.serverless/',
    '*.min.js'
  ]
};