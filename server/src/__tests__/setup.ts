// Global test setup — runs before every test file.
// Set the minimum env vars required by the app so tests don't depend on a .env file.
process.env.JWT_SECRET = 'test_jwt_secret_for_jest_suite';
process.env.NODE_ENV = 'test';
// No AI key → forces the fallback path tested in aiAssistant.test.ts
delete process.env.GROQ_API_KEY;
delete process.env.OPENAI_API_KEY;
