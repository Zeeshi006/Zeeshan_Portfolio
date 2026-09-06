// Suppress NestJS logger noise in test output unless DEBUG_TESTS=1
if (!process.env['DEBUG_TESTS']) {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
}
