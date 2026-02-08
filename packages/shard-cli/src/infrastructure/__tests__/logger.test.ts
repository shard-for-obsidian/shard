import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { CliLogger } from "../logger.js";

describe("CliLogger", () => {
  let tempDir: string;
  let logFile: string;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Create a temporary directory for test log files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shard-logger-test-"));
    logFile = path.join(tempDir, "test.log");

    // Spy on stderr write
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(async () => {
    // Cleanup
    stderrSpy.mockRestore();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("normal mode", () => {
    it("should write user-friendly messages to stderr", () => {
      const logger = new CliLogger({ mode: "normal", logFile });

      logger.info("Test info message");
      logger.success("Test success message");
      logger.warn("Test warning message");
      logger.error("Test error message");

      // Verify stderr was called with user-friendly messages
      expect(stderrSpy).toHaveBeenCalled();
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0]).join("");

      expect(stderrOutput).toContain("Test info message");
      expect(stderrOutput).toContain("Test success message");
      expect(stderrOutput).toContain("Test warning message");
      expect(stderrOutput).toContain("Test error message");
    });

    it("should not write debug or trace messages to stderr", () => {
      const logger = new CliLogger({ mode: "normal", logFile });

      logger.debug("Test debug message");
      logger.trace("Test trace message");

      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0]).join("");

      // Debug and trace should not appear in stderr for normal mode
      expect(stderrOutput).not.toContain("Test debug message");
      expect(stderrOutput).not.toContain("Test trace message");
    });

    it("should always write all messages to log file", async () => {
      const logger = new CliLogger({ mode: "normal", logFile });

      logger.info("Info to file");
      logger.debug("Debug to file");
      logger.trace("Trace to file");

      // Wait for file write (pino is async)
      await new Promise((resolve) => setTimeout(resolve, 100));

      const logContent = await fs.readFile(logFile, "utf-8");

      expect(logContent).toContain("Info to file");
      expect(logContent).toContain("Debug to file");
      expect(logContent).toContain("Trace to file");
    });
  });

  describe("json mode", () => {
    it("should suppress all stderr output", () => {
      const logger = new CliLogger({ mode: "json", logFile });

      logger.info("Test info");
      logger.success("Test success");
      logger.warn("Test warning");
      logger.error("Test error");
      logger.debug("Test debug");
      logger.trace("Test trace");

      // No stderr output in json mode
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("should write all messages to log file", async () => {
      const logger = new CliLogger({ mode: "json", logFile });

      logger.info("Info message");
      logger.error("Error message");
      logger.debug("Debug message");

      // Wait for file write
      await new Promise((resolve) => setTimeout(resolve, 100));

      const logContent = await fs.readFile(logFile, "utf-8");

      expect(logContent).toContain("Info message");
      expect(logContent).toContain("Error message");
      expect(logContent).toContain("Debug message");
    });

    it("should return null for spinner creation", () => {
      const logger = new CliLogger({ mode: "json", logFile });

      const spinner = logger.spinner("Loading...");

      expect(spinner).toBeNull();
    });
  });

  describe("verbose mode", () => {
    it("should create logger for verbose mode without errors", async () => {
      // In verbose mode, pino-pretty transport writes to stderr via worker thread
      // We can't easily spy on this, but we can verify the logger works
      const logger = new CliLogger({ mode: "verbose", logFile });

      // These should not throw
      logger.info("Verbose info message");
      logger.debug("Verbose debug message");
      logger.trace("Verbose trace message");

      // Verify the logger was created successfully
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });

    it("should write all messages to log file", async () => {
      const logger = new CliLogger({ mode: "verbose", logFile });

      logger.info("Verbose info");
      logger.debug("Verbose debug");
      logger.trace("Verbose trace");

      // Wait for file write
      await new Promise((resolve) => setTimeout(resolve, 100));

      const logContent = await fs.readFile(logFile, "utf-8");

      expect(logContent).toContain("Verbose info");
      expect(logContent).toContain("Verbose debug");
      expect(logContent).toContain("Verbose trace");
    });
  });

  describe("progress methods", () => {
    it("should provide progress bar stub", () => {
      const logger = new CliLogger({ mode: "normal", logFile });

      const progress = logger.progress(100);

      expect(progress).toBeDefined();
      expect(typeof progress.start).toBe("function");
      expect(typeof progress.update).toBe("function");
      expect(typeof progress.stop).toBe("function");
    });
  });
});
