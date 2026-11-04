import { describe, expect, it } from 'vitest';
import { stepAlongPath } from '../src/index.js';

describe('stepAlongPath', () => {
  it('avanza según la velocidad y el tiempo', () => {
    const m = { x: 0.5, y: 0.5, path: [{ x: 3, y: 0 }] };
    stepAlongPath(m, 1, 2);
    expect(m.x).toBeCloseTo(2.5);
    expect(m.path).toHaveLength(1);
  });

  it('consume varias baldosas en un mismo paso y se detiene al final', () => {
    const m = {
      x: 0.5,
      y: 0.5,
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    };
    expect(stepAlongPath(m, 10, 3)).toBe(true);
    expect(m).toEqual({ x: 2.5, y: 0.5, path: [] });
    expect(stepAlongPath(m, 1, 3)).toBe(false);
  });
});
