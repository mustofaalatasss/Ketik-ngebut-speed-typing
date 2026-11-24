import { describe, expect, it, vi } from 'vitest';
import { ResourceTracker } from './resourceTracker';

describe('Pelepasan sumber daya Three.js', () => {
  it('GAM_1_Dispose_MelepasSemuaGeometryMaterialTexture', () => {
    const tracker = new ResourceTracker();
    const geometry = { dispose: vi.fn() };
    const material = { dispose: vi.fn() };
    const texture = { dispose: vi.fn() };

    expect(tracker.track(geometry)).toBe(geometry);
    tracker.track(material);
    tracker.track(texture);
    tracker.track(material); // sumber daya bersama hanya dicatat sekali
    expect(tracker.size).toBe(3);

    tracker.dispose();

    expect(geometry.dispose).toHaveBeenCalledTimes(1);
    expect(material.dispose).toHaveBeenCalledTimes(1);
    expect(texture.dispose).toHaveBeenCalledTimes(1);
    expect(tracker.size).toBe(0);

    tracker.dispose();
    expect(geometry.dispose).toHaveBeenCalledTimes(1);
  });
});
