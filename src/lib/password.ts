import { createHash, timingSafeEqual } from 'node:crypto';

export function passwordMatches(expected: string, got: string | null): boolean {
  const left = createHash('sha256').update(expected).digest();
  const right = createHash('sha256').update(got ?? '').digest();
  return timingSafeEqual(left, right);
}
