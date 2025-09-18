export interface AutosaveMetrics {
  totalSaves: number;
  successfulSaves: number;
  failedSaves: number;
  averageDebounceTime: number;
  averageSaveTime: number;
  cacheHits: number;
  cacheMisses: number;
  retryCount: number;
}

export class MetricsCollector {
  constructor(private enabled: boolean = true) {}

  private metrics: AutosaveMetrics = {
    totalSaves: 0,
    successfulSaves: 0,
    failedSaves: 0,
    averageDebounceTime: 0,
    averageSaveTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    retryCount: 0,
  };

  recordSave(duration: number, success: boolean): void {
    if (!this.enabled) return;
    this.metrics.totalSaves++;
    if (success) {
      this.metrics.successfulSaves++;
    } else {
      this.metrics.failedSaves++;
    }

    this.updateAverageSaveTime(duration);
  }

  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  recordRetry(): void {
    this.metrics.retryCount++;
  }

  recordDebounce(duration: number): void {
    this.updateAverageDebounceTime(duration);
  }

  getMetrics(): Readonly<AutosaveMetrics> {
    return { ...this.metrics };
  }

  getSuccessRate(): number {
    if (this.metrics.totalSaves === 0) return 1;
    return this.metrics.successfulSaves / this.metrics.totalSaves;
  }

  getCacheHitRate(): number {
    const totalCacheAccesses =
      this.metrics.cacheHits + this.metrics.cacheMisses;
    if (totalCacheAccesses === 0) return 0;
    return this.metrics.cacheHits / totalCacheAccesses;
  }

  reset(): void {
    this.metrics = {
      totalSaves: 0,
      successfulSaves: 0,
      failedSaves: 0,
      averageDebounceTime: 0,
      averageSaveTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      retryCount: 0,
    };
  }

  private updateAverageSaveTime(duration: number): void {
    const total = this.metrics.totalSaves;
    this.metrics.averageSaveTime =
      (this.metrics.averageSaveTime * (total - 1) + duration) / total;
  }

  private updateAverageDebounceTime(duration: number): void {
    // Simple moving average for debounce time
    this.metrics.averageDebounceTime =
      (this.metrics.averageDebounceTime + duration) / 2;
  }
}
