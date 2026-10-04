import { describe, it, expect } from 'vitest';
import { router } from '@/router';

function paths(routes: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const r of routes as { path?: string; children?: unknown[] }[]) {
    if (r.path) out.push(r.path);
    if (r.children) out.push(...paths(r.children));
  }
  return out;
}

describe('routes pilotage', () => {
  it('déclare les deux cockpits', () => {
    const all = paths(router.routes);
    expect(all).toContain('dashboard/pilotage-national');
    expect(all).toContain('dashboard/pilotage-regional');
  });
});
