/**
 * Performance benchmarking utilities for the Farcaster Indexer
 *
 * This module provides benchmarking tools to measure and monitor
 * the performance of various system components.
 */

import { performance } from "perf_hooks";

export interface BenchmarkResult {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter: NodeJS.MemoryUsage;
  memoryDelta: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

export interface BenchmarkSuite {
  name: string;
  results: BenchmarkResult[];
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  memoryLeakDetected: boolean;
}

export class PerformanceBenchmark {
  private startTime = 0;
  private name = "";
  private memoryBefore: NodeJS.MemoryUsage = process.memoryUsage();

  /**
   * Start a benchmark measurement
   */
  start(name: string): void {
    this.name = name;
    this.memoryBefore = process.memoryUsage();
    this.startTime = performance.now();
  }

  /**
   * End a benchmark measurement and return the result
   */
  end(): BenchmarkResult {
    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();
    const duration = endTime - this.startTime;

    const memoryDelta = {
      heapUsed: memoryAfter.heapUsed - this.memoryBefore.heapUsed,
      heapTotal: memoryAfter.heapTotal - this.memoryBefore.heapTotal,
      external: memoryAfter.external - this.memoryBefore.external,
      rss: memoryAfter.rss - this.memoryBefore.rss,
    };

    return {
      name: this.name,
      duration,
      startTime: this.startTime,
      endTime,
      memoryBefore: this.memoryBefore,
      memoryAfter,
      memoryDelta,
    };
  }

  /**
   * Measure the performance of an async function
   */
  static async measure<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; benchmark: BenchmarkResult }> {
    const benchmark = new PerformanceBenchmark();
    benchmark.start(name);

    try {
      const result = await fn();
      const benchmarkResult = benchmark.end();
      return { result, benchmark: benchmarkResult };
    } catch (error) {
      benchmark.end(); // Still record the timing even if it fails
      throw error;
    }
  }

  /**
   * Measure the performance of a synchronous function
   */
  static measureSync<T>(
    name: string,
    fn: () => T
  ): { result: T; benchmark: BenchmarkResult } {
    const benchmark = new PerformanceBenchmark();
    benchmark.start(name);

    try {
      const result = fn();
      const benchmarkResult = benchmark.end();
      return { result, benchmark: benchmarkResult };
    } catch (error) {
      benchmark.end(); // Still record the timing even if it fails
      throw error;
    }
  }
}

export class BenchmarkSuiteRunner {
  private results: BenchmarkResult[] = [];
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Add a benchmark result to the suite
   */
  addResult(result: BenchmarkResult): void {
    this.results.push(result);
  }

  /**
   * Run a benchmark and add it to the suite
   */
  async runBenchmark<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const { result, benchmark } = await PerformanceBenchmark.measure(name, fn);
    this.addResult(benchmark);
    return result;
  }

  /**
   * Run a synchronous benchmark and add it to the suite
   */
  runBenchmarkSync<T>(name: string, fn: () => T): T {
    const { result, benchmark } = PerformanceBenchmark.measureSync(name, fn);
    this.addResult(benchmark);
    return result;
  }

  /**
   * Get the complete suite results with statistics
   */
  getResults(): BenchmarkSuite {
    const durations = this.results.map((r) => r.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageDuration = totalDuration / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    // Detect potential memory leaks (cumulative memory growth > 50MB)
    const totalMemoryGrowth = this.results.reduce(
      (sum, r) => sum + r.memoryDelta.heapUsed,
      0
    );
    const memoryLeakDetected = totalMemoryGrowth > 50 * 1024 * 1024; // 50MB

    return {
      name: this.name,
      results: this.results,
      totalDuration,
      averageDuration,
      minDuration,
      maxDuration,
      memoryLeakDetected,
    };
  }

  /**
   * Clear all results
   */
  clear(): void {
    this.results = [];
  }

  /**
   * Generate a report of the benchmark suite
   */
  generateReport(): string {
    const suite = this.getResults();

    let report = `\n📊 Benchmark Suite: ${suite.name}\n`;
    report += `${"=".repeat(50)}\n`;
    report += `Total Duration: ${suite.totalDuration.toFixed(2)}ms\n`;
    report += `Average Duration: ${suite.averageDuration.toFixed(2)}ms\n`;
    report += `Min Duration: ${suite.minDuration.toFixed(2)}ms\n`;
    report += `Max Duration: ${suite.maxDuration.toFixed(2)}ms\n`;
    report += `Tests Run: ${suite.results.length}\n`;

    if (suite.memoryLeakDetected) {
      report += `⚠️  Potential memory leak detected!\n`;
    }

    report += `\n📋 Individual Results:\n`;
    report += `${"-".repeat(50)}\n`;

    suite.results.forEach((result) => {
      const memoryMB = result.memoryDelta.heapUsed / (1024 * 1024);
      report += `${result.name.padEnd(30)} ${result.duration.toFixed(2)}ms`;
      report += ` (${memoryMB > 0 ? "+" : ""}${memoryMB.toFixed(2)}MB)\n`;
    });

    return report;
  }
}

/**
 * Database operation benchmarks
 */
export class DatabaseBenchmarks {
  private suite: BenchmarkSuiteRunner;

  constructor() {
    this.suite = new BenchmarkSuiteRunner("Database Operations");
  }

  /**
   * Benchmark a database query
   */
  async benchmarkQuery<T>(name: string, queryFn: () => Promise<T>): Promise<T> {
    return await this.suite.runBenchmark(`DB Query: ${name}`, queryFn);
  }

  /**
   * Benchmark a database insert operation
   */
  async benchmarkInsert<T>(
    name: string,
    insertFn: () => Promise<T>
  ): Promise<T> {
    return await this.suite.runBenchmark(`DB Insert: ${name}`, insertFn);
  }

  /**
   * Benchmark a database update operation
   */
  async benchmarkUpdate<T>(
    name: string,
    updateFn: () => Promise<T>
  ): Promise<T> {
    return await this.suite.runBenchmark(`DB Update: ${name}`, updateFn);
  }

  /**
   * Get the benchmark results
   */
  getResults(): BenchmarkSuite {
    return this.suite.getResults();
  }

  /**
   * Generate a report
   */
  generateReport(): string {
    return this.suite.generateReport();
  }

  /**
   * Clear results
   */
  clear(): void {
    this.suite.clear();
  }
}

/**
 * API endpoint benchmarks
 */
export class APIBenchmarks {
  private suite: BenchmarkSuiteRunner;

  constructor() {
    this.suite = new BenchmarkSuiteRunner("API Endpoints");
  }

  /**
   * Benchmark an API endpoint
   */
  async benchmarkEndpoint<T>(
    endpoint: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    return await this.suite.runBenchmark(`API: ${endpoint}`, requestFn);
  }

  /**
   * Get the benchmark results
   */
  getResults(): BenchmarkSuite {
    return this.suite.getResults();
  }

  /**
   * Generate a report
   */
  generateReport(): string {
    return this.suite.generateReport();
  }

  /**
   * Clear results
   */
  clear(): void {
    this.suite.clear();
  }
}

/**
 * Job processing benchmarks
 */
export class JobBenchmarks {
  private suite: BenchmarkSuiteRunner;

  constructor() {
    this.suite = new BenchmarkSuiteRunner("Job Processing");
  }

  /**
   * Benchmark a job processing operation
   */
  async benchmarkJob<T>(jobType: string, jobFn: () => Promise<T>): Promise<T> {
    return await this.suite.runBenchmark(`Job: ${jobType}`, jobFn);
  }

  /**
   * Get the benchmark results
   */
  getResults(): BenchmarkSuite {
    return this.suite.getResults();
  }

  /**
   * Generate a report
   */
  generateReport(): string {
    return this.suite.generateReport();
  }

  /**
   * Clear results
   */
  clear(): void {
    this.suite.clear();
  }
}

/**
 * System performance monitoring
 */
export class SystemMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private measurements: Array<{
    timestamp: number;
    memory: NodeJS.MemoryUsage;
    uptime: number;
  }> = [];

  /**
   * Start monitoring system performance
   */
  start(intervalMs = 5000): void {
    if (this.intervalId) {
      this.stop();
    }

    this.intervalId = setInterval(() => {
      this.measurements.push({
        timestamp: Date.now(),
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      });
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Get current system stats
   */
  getCurrentStats() {
    const memory = process.memoryUsage();
    return {
      timestamp: Date.now(),
      memory: {
        heapUsed: memory.heapUsed / (1024 * 1024), // MB
        heapTotal: memory.heapTotal / (1024 * 1024), // MB
        external: memory.external / (1024 * 1024), // MB
        rss: memory.rss / (1024 * 1024), // MB
      },
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage(),
    };
  }

  /**
   * Get measurements history
   */
  getMeasurements() {
    return this.measurements.map((m) => ({
      timestamp: m.timestamp,
      memory: {
        heapUsed: m.memory.heapUsed / (1024 * 1024),
        heapTotal: m.memory.heapTotal / (1024 * 1024),
        external: m.memory.external / (1024 * 1024),
        rss: m.memory.rss / (1024 * 1024),
      },
      uptime: m.uptime,
    }));
  }

  /**
   * Clear measurements
   */
  clear(): void {
    this.measurements = [];
  }

  /**
   * Generate a monitoring report
   */
  generateReport(): string {
    if (this.measurements.length === 0) {
      return "No measurements available";
    }

    const measurements = this.getMeasurements();
    const latest = measurements[measurements.length - 1];
    const first = measurements[0];

    const memoryGrowth = latest.memory.heapUsed - first.memory.heapUsed;
    const timespan = latest.timestamp - first.timestamp;

    let report = `\n🖥️  System Monitor Report\n`;
    report += `${"=".repeat(50)}\n`;
    report += `Monitoring Period: ${(timespan / 1000).toFixed(1)}s\n`;
    report += `Measurements: ${measurements.length}\n`;
    report += `Current Memory Usage: ${latest.memory.heapUsed.toFixed(2)}MB\n`;
    report += `Memory Growth: ${memoryGrowth > 0 ? "+" : ""}${memoryGrowth.toFixed(2)}MB\n`;
    report += `System Uptime: ${latest.uptime.toFixed(1)}s\n`;

    // Memory trend analysis
    if (memoryGrowth > 10) {
      report += `⚠️  High memory growth detected (${memoryGrowth.toFixed(2)}MB)\n`;
    } else if (memoryGrowth > 5) {
      report += `📈 Moderate memory growth (${memoryGrowth.toFixed(2)}MB)\n`;
    } else {
      report += `✅ Memory usage stable\n`;
    }

    return report;
  }
}

/**
 * Global performance tracking utilities
 */
export const benchmarks = {
  database: new DatabaseBenchmarks(),
  api: new APIBenchmarks(),
  jobs: new JobBenchmarks(),
  monitor: new SystemMonitor(),
};

/**
 * Generate a comprehensive performance report
 */
export function generatePerformanceReport(): string {
  let report = `\n🚀 Farcaster Indexer Performance Report\n`;
  report += `${"=".repeat(60)}\n`;
  report += `Generated: ${new Date().toISOString()}\n`;

  // System monitor report
  report += benchmarks.monitor.generateReport();

  // Database benchmarks
  const dbResults = benchmarks.database.getResults();
  if (dbResults.results.length > 0) {
    report += benchmarks.database.generateReport();
  }

  // API benchmarks
  const apiResults = benchmarks.api.getResults();
  if (apiResults.results.length > 0) {
    report += benchmarks.api.generateReport();
  }

  // Job benchmarks
  const jobResults = benchmarks.jobs.getResults();
  if (jobResults.results.length > 0) {
    report += benchmarks.jobs.generateReport();
  }

  return report;
}

/**
 * Performance test thresholds for CI/CD
 */
export const PERFORMANCE_THRESHOLDS = {
  // Database operation thresholds (ms)
  DATABASE_QUERY_MAX: 100,
  DATABASE_INSERT_MAX: 50,
  DATABASE_BULK_INSERT_MAX: 500,

  // API endpoint thresholds (ms)
  API_RESPONSE_MAX: 500,
  API_FEED_MAX: 1000,

  // Job processing thresholds (ms)
  JOB_PROCESS_EVENT_MAX: 100,
  JOB_BACKFILL_USER_MAX: 5000,

  // Memory thresholds (MB)
  MEMORY_LEAK_THRESHOLD: 50,
  MEMORY_USAGE_MAX: 500,
} as const;

/**
 * Validate performance against thresholds
 */
export function validatePerformance(): {
  passed: boolean;
  failures: string[];
  warnings: string[];
} {
  const failures: string[] = [];
  const warnings: string[] = [];

  // Check database benchmarks
  const dbResults = benchmarks.database.getResults();
  if (dbResults.averageDuration > PERFORMANCE_THRESHOLDS.DATABASE_QUERY_MAX) {
    failures.push(
      `Database average duration ${dbResults.averageDuration.toFixed(2)}ms exceeds threshold ${PERFORMANCE_THRESHOLDS.DATABASE_QUERY_MAX}ms`
    );
  }

  // Check API benchmarks
  const apiResults = benchmarks.api.getResults();
  if (apiResults.averageDuration > PERFORMANCE_THRESHOLDS.API_RESPONSE_MAX) {
    failures.push(
      `API average duration ${apiResults.averageDuration.toFixed(2)}ms exceeds threshold ${PERFORMANCE_THRESHOLDS.API_RESPONSE_MAX}ms`
    );
  }

  // Check job benchmarks
  const jobResults = benchmarks.jobs.getResults();
  if (
    jobResults.averageDuration > PERFORMANCE_THRESHOLDS.JOB_PROCESS_EVENT_MAX
  ) {
    warnings.push(
      `Job average duration ${jobResults.averageDuration.toFixed(2)}ms exceeds threshold ${PERFORMANCE_THRESHOLDS.JOB_PROCESS_EVENT_MAX}ms`
    );
  }

  // Check memory leaks
  if (
    dbResults.memoryLeakDetected ||
    apiResults.memoryLeakDetected ||
    jobResults.memoryLeakDetected
  ) {
    failures.push("Memory leak detected in one or more benchmark suites");
  }

  return {
    passed: failures.length === 0,
    failures,
    warnings,
  };
}
