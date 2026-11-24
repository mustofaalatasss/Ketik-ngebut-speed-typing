export interface Disposable {
  dispose(): void;
}

/**
 * Mencatat geometry, material, dan texture Three.js agar semuanya bisa dilepas sekaligus
 * saat komponen dilepas (mencegah kebocoran memori GPU). Tidak mengimpor Three.js sehingga mudah dites.
 */
export class ResourceTracker {
  private readonly resources = new Set<Disposable>();

  track<T extends Disposable>(resource: T): T {
    this.resources.add(resource);
    return resource;
  }

  get size(): number {
    return this.resources.size;
  }

  dispose(): void {
    for (const r of this.resources) r.dispose();
    this.resources.clear();
  }
}
