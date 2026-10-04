/**
 * Deterministic Seeded Pseudorandom Number Generator (Mulberry32).
 * Guarantees that any battlefield exercise can be reproduced bit-for-bit during AAR replay.
 */
export class SeededPRNG {
  private s: number;

  constructor(seed: number = 1337) {
    this.s = seed | 0;
  }

  /**
   * Returns a float between 0 (inclusive) and 1 (exclusive).
   */
  public next(): number {
    this.s = (this.s + 0x6D2B79F5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a float between min and max.
   */
  public nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Returns an integer between min and max (inclusive).
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.nextRange(min, max + 1));
  }

  /**
   * Gaussian/Normal distribution via Box-Muller transform
   */
  public nextGaussian(mean: number = 0, stdDev: number = 1): number {
    let u1 = this.next();
    let u2 = this.next();
    while (u1 === 0) u1 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  }
}
