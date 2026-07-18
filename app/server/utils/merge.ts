const blockedKeys = new Set(['__proto__', 'prototype', 'constructor']);

export function assertSafeObject(value: unknown, depth = 0): void {
  if (depth > 20) throw Object.assign(new Error('JSON 嵌套过深'), { status: 400, code: 'JSON_TOO_DEEP' });
  if (Array.isArray(value)) return value.forEach((item) => assertSafeObject(item, depth + 1));
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (blockedKeys.has(key)) throw Object.assign(new Error('JSON 包含被禁止的键'), { status: 400, code: 'UNSAFE_JSON_KEY' });
    assertSafeObject(item, depth + 1);
  }
}

export function deepMerge<T>(base: T, changes: unknown): T {
  assertSafeObject(changes);
  if (Array.isArray(changes)) return structuredClone(changes) as T;
  if (!changes || typeof changes !== 'object') return changes as T;
  const output: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(changes)) {
    const current = output[key];
    output[key] = value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object' && !Array.isArray(current)
      ? deepMerge(current, value)
      : structuredClone(value);
  }
  return output as T;
}
