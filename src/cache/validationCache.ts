export class ValidationCache {
  private cache = new Map<string, boolean>();

  constructor(private readonly maxSize = 50) {}

  get(key: string): boolean | undefined {
    return this.cache.get(key);
  }

  set(key: string, valid: boolean): void {
    this.cache.set(key, valid);
    this.cleanup();
  }

  clear(): void {
    this.cache.clear();
  }

  // Add missing size method
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
  entries(): Array<[string, boolean]> {
    return Array.from(this.cache.entries());
  }

  private cleanup(): void {
    if (this.cache.size <= this.maxSize) return;

    const entries = Array.from(this.cache.entries());
    const toRemove = entries.slice(0, entries.length - this.maxSize);
    toRemove.forEach(([key]) => this.cache.delete(key));
  }
}
