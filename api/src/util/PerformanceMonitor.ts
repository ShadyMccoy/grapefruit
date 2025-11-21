import { performance } from 'perf_hooks';

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private enabled: boolean = true;

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private stats: Map<string, { count: number; total: number; min: number; max: number }> = new Map();

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  start(label: string): number {
    if (!this.enabled) return 0;
    return performance.now();
  }

  end(label: string, startTime: number, metadata?: Record<string, any>) {
    if (!this.enabled) return;
    const duration = performance.now() - startTime;
    
    // Update stats
    const stat = this.stats.get(label) || { count: 0, total: 0, min: Infinity, max: -Infinity };
    stat.count++;
    stat.total += duration;
    stat.min = Math.min(stat.min, duration);
    stat.max = Math.max(stat.max, duration);
    this.stats.set(label, stat);

    const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
    // console.log(`[Perf] ${label}: ${duration.toFixed(2)}ms${metaStr}`); // Commented out to reduce noise, use report() instead
  }

  recordMetric(label: string, value: number) {
    if (!this.enabled) return;
    const stat = this.stats.get(label) || { count: 0, total: 0, min: Infinity, max: -Infinity };
    stat.count++;
    stat.total += value;
    stat.min = Math.min(stat.min, value);
    stat.max = Math.max(stat.max, value);
    this.stats.set(label, stat);
  }

  report() {
    console.log("\n=== Performance Report ===");
    console.table(
      Array.from(this.stats.entries()).map(([label, stat]) => ({
        Label: label,
        Count: stat.count,
        "Avg (ms)": (stat.total / stat.count).toFixed(2),
        "Min (ms)": stat.min.toFixed(2),
        "Max (ms)": stat.max.toFixed(2),
        "Total (ms)": stat.total.toFixed(2)
      }))
    );
    console.log("==========================\n");
  }

  reset() {
    this.stats.clear();
  }

  async measure<T>(label: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const start = this.start(label);
    try {
      const result = await fn();
      return result;
    } finally {
      this.end(label, start, metadata);
    }
  }
}

export const perf = PerformanceMonitor.getInstance();
