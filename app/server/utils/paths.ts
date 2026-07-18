import path from 'node:path';
import crypto from 'node:crypto';

const windowsReserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function isSafeProjectId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{2,63}$/.test(id) && !windowsReserved.test(id) && !id.endsWith('.') && !id.endsWith(' ');
}

export function safeResolve(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw Object.assign(new Error('路径越界已被拒绝'), { status: 400, code: 'PATH_TRAVERSAL' });
  }
  return target;
}

export function assertSafeProjectId(id: string): void {
  if (!isSafeProjectId(id)) throw Object.assign(new Error('项目 ID 非法'), { status: 400, code: 'INVALID_PROJECT_ID' });
}

export function slugifyName(name: string): string {
  const ascii = name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const base = ascii || 'project';
  return `${base.slice(0, 45)}-${crypto.randomBytes(4).toString('hex')}`;
}

export function safeStoredName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const base = path.basename(originalName, ext).normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '').slice(0, 60) || 'material';
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${base}${ext}`;
}
