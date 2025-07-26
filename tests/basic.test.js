const { describe, test, expect } = require('@jest/globals');

describe('Basic project setup', () => {
  test('project structure exists', () => {
    expect(require('../package.json').name).toBe('cloud-remediator-sage');
  });
});