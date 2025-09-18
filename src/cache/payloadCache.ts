import type { SaveResult } from "../core/types";

export interface CacheEntry {
  result: SaveResult;
  timestamp: number;
  hits: number;
}

export class PayloadCache {
  private cache = new Map<string, CacheEntry>();

  constructor(
    private readonly maxSize = 100,
    private readonly ttlMs = 5 * 60 * 1000
  ) {}

  get(key: string): SaveResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.result;
  }

  set(key: string, result: SaveResult): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      hits: 0,
    });

    this.cleanup();
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Add has method for completeness
  has(key: string): boolean {
    return this.cache.has(key);
  }

  // Add delete method for completeness
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  // Add keys method for debugging
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // Add entries method for debugging
  entries(): Array<[string, CacheEntry]> {
    return Array.from(this.cache.entries());
  }

  // Add stats method for monitoring
  getStats(): {
    size: number;
    totalHits: number;
    averageHits: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const timestamps = entries.map((entry) => entry.timestamp);

    return {
      size: this.cache.size,
      totalHits,
      averageHits: entries.length > 0 ? totalHits / entries.length : 0,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    };
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.ttlMs;
  }

  private cleanup(): void {
    if (this.cache.size <= this.maxSize) return;

    // Remove expired entries first
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    }

    // If still over limit, remove least recently used
    if (this.cache.size > this.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.slice(0, entries.length - this.maxSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }
}
