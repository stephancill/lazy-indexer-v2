import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

beforeAll(() => {
  process.env.NODE_ENV = "test";
});

afterAll(() => {
  delete process.env.NODE_ENV;
});

beforeEach(() => {
  // Reset any mocks or test state before each test
});

afterEach(() => {
  // Cleanup after each test
});
