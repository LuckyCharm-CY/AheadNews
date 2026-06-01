// Global test setup — runs once before all suites.
// Keep this file lean: only truly global configuration belongs here.

// Silence noisy console.warn output from React Native internals during tests.
jest.spyOn(console, 'warn').mockImplementation(() => {});
