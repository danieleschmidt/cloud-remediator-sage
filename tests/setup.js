// Jest test setup
process.env.NODE_ENV = 'test';
process.env.NEPTUNE_ENDPOINT = 'test-endpoint';
process.env.STAGE = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';

// Mock AWS SDK to avoid actual API calls during tests
jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    getObject: jest.fn(() => ({
      promise: jest.fn(() => Promise.resolve({ Body: '{}' }))
    })),
    putObjectTagging: jest.fn(() => ({
      promise: jest.fn(() => Promise.resolve())
    }))
  })),
  SQS: jest.fn(() => ({
    sendMessage: jest.fn(() => ({
      promise: jest.fn(() => Promise.resolve())
    }))
  })),
  Lambda: jest.fn(() => ({
    invoke: jest.fn(() => ({
      promise: jest.fn(() => Promise.resolve({ 
        StatusCode: 200,
        Payload: JSON.stringify({ success: true })
      }))
    }))
  })),
  config: {
    update: jest.fn()
  }
}));