import { describe, it, expect } from "vitest";
import { Logger } from "./logger.js";

describe("Logger", () => {
  it("should return singleton instance", () => {
    const instance1 = Logger.getInstance();
    const instance2 = Logger.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("should have all required methods", () => {
    const logger = Logger.getInstance();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.success).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.startSpinner).toBe("function");
    expect(typeof logger.stopSpinner).toBe("function");
    expect(typeof logger.table).toBe("function");
    expect(typeof logger.json).toBe("function");
    expect(typeof logger.line).toBe("function");
  });

  it("should handle empty table data", () => {
    const logger = Logger.getInstance();
    expect(() => logger.table([])).not.toThrow();
  });

  it("should handle table data with content", () => {
    const logger = Logger.getInstance();
    const data = [{ name: "test", value: 42 }];
    expect(() => logger.table(data)).not.toThrow();
  });

  it("should handle json output", () => {
    const logger = Logger.getInstance();
    const data = { test: "value" };
    expect(() => logger.json(data)).not.toThrow();
  });
});
