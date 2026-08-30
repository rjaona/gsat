import { it, expect } from 'vitest';
import { router } from '@/router';

function paths(routes: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const r of routes as Array<{ path?: string }>) {
    if (r.path) out.push(r.path);
  }
  return out;
}

it('expose /forgot-password et /reset-password comme routes de premier niveau (publiques)', () => {
  const topLevel = paths(router.routes as unknown[]);
  expect(topLevel).toContain('/forgot-password');
  expect(topLevel).toContain('/reset-password');
});
