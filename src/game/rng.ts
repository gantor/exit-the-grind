// Small seeded PRNG (mulberry32) so games are reproducible and the RNG state can be saved.
export function nextRandom(state: number): [number, number] {
  let t = (state + 0x6d2b79f5) | 0
  const next = t
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [value, next]
}

export function newSeed(): number {
  return (Math.random() * 2 ** 31) | 0
}
