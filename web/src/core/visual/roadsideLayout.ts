import { randomRange, seededRandom } from '../util/random';

export type RoadsideKind = 'pine' | 'roundTree' | 'lamp' | 'marker' | 'railPost';

export interface RoadsideItem {
  readonly kind: RoadsideKind;
  readonly x: number;
  readonly z: number;
  readonly scale: number;
  readonly rotationY: number;
}

export interface RoadsideLayoutOptions {
  readonly seed: number;
  readonly span: number;
  readonly behind: number;
  readonly roadWidth: number;
  readonly treeCount: number;
  readonly lampCount: number;
  readonly markerCount: number;
  readonly railPostSpacing: number;
  readonly treeMinOffset: number;
  readonly treeMaxOffset: number;
}

/**
 * Menyusun objek tepi jalan secara deterministik (seed sama -> dunia sama).
 * Pohon lebih rapat dekat jalan, karena objek dekat yang lewat cepat paling terasa.
 */
export function createRoadsideLayout(o: RoadsideLayoutOptions): RoadsideItem[] {
  const random = seededRandom(o.seed);
  const items: RoadsideItem[] = [];
  const edge = o.roadWidth / 2;
  const zAt = (t: number): number => o.behind - t * o.span;

  for (let i = 0; i < o.treeCount; i++) {
    const side = random() < 0.5 ? -1 : 1;
    // Kuadrat dari bilangan acak -> lebih banyak pohon dekat jalan.
    const offset = o.treeMinOffset + (o.treeMaxOffset - o.treeMinOffset) * random() ** 2;
    items.push({
      kind: random() < 0.55 ? 'pine' : 'roundTree',
      x: side * (edge + offset),
      z: zAt(random()),
      scale: randomRange(random, 0.75, 1.35),
      rotationY: randomRange(random, 0, Math.PI * 2),
    });
  }

  for (let i = 0; i < o.lampCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    items.push({
      kind: 'lamp',
      x: side * (edge + 1.6),
      z: zAt((i + 0.5) / o.lampCount),
      scale: 1,
      rotationY: side < 0 ? 0 : Math.PI,
    });
  }

  for (let i = 0; i < o.markerCount; i++) {
    items.push({ kind: 'marker', x: edge + 2.4, z: zAt((i + 0.25) / o.markerCount), scale: 1, rotationY: 0 });
  }

  const postCount = Math.floor(o.span / o.railPostSpacing);
  for (let i = 0; i < postCount; i++) {
    for (const side of [-1, 1]) {
      items.push({
        kind: 'railPost',
        x: side * (edge + 1.05),
        z: o.behind - i * o.railPostSpacing,
        scale: 1,
        rotationY: 0,
      });
    }
  }

  return items;
}
