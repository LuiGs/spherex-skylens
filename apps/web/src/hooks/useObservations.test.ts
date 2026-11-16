import { describe, expect, it } from 'vitest';
import { observationsRequest } from './useObservations';

describe('observationsRequest', () => {
  it('snaps the size to a step and rounds the position', () => {
    expect(observationsRequest(269.4521234, 4.6934567, 0.6)).toEqual({ ra: 269.4521, dec: 4.6935, size: 1 });
    expect(observationsRequest(10, -5, 0.03).size).toBe(0.05);
    expect(observationsRequest(10, -5, 0.2).size).toBe(0.2);
    expect(observationsRequest(10, -5, 7).size).toBe(1);
  });
});
