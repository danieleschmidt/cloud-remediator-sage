// Security-focused ESLint configuration for CI/CD pipeline
// Extends the main .eslintrc.js with stricter security rules
module.exports = {
  extends: ['./.eslintrc.js'],
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
    'no-process-env': 'warn', // Allow but warn about process.env usage
    'no-process-exit': 'error',
    
    // AWS Lambda specific security
    'node/no-process-exit': 'error',
    'node/no-sync': 'error'
  },
  
  // Security-focused environments
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  
  // Stricter parser options
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      impliedStrict: true
    }
  }
};