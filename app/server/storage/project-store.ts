import fs from 'node:fs/promises';
import path from 'node:path';
import { projectSchema, type Project } from '../schemas/project.js';
import { assertSafeProjectId, safeResolve } from '../utils/paths.js';

export class RevisionConflictError extends Error {
  status = 409;
  code = 'REVISION_CONFLICT';
}

export class ProjectStore {
  private queues = new Map<string, Promise<unknown>>();
  constructor(public readonly dataDir: string) {}

  projectDir(id: string): string {
    assertSafeProjectId(id);
    return safeResolve(this.dataDir, 'projects', id);
  }

  projectFile(id: string): string {
    return safeResolve(this.projectDir(id), 'project.json');
  }

  async initialize(): Promise<void> {
    await Promise.all(['projects', 'backups', 'logs'].map((dir) => fs.mkdir(safeResolve(this.dataDir, dir), { recursive: true })));
  }

  async list(): Promise<Project[]> {
    await this.initialize();
    const entries = await fs.readdir(safeResolve(this.dataDir, 'projects'), { withFileTypes: true });
    const results: Project[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try { results.push(await this.read(entry.name)); } catch { /* isolate corrupt project */ }
    }
    return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async exists(id: string): Promise<boolean> {
    try { await fs.access(this.projectFile(id)); return true; } catch { return false; }
  }

  async read(id: string): Promise<Project> {
    const file = this.projectFile(id);
    try {
      const raw = await fs.readFile(file, 'utf8');
      return projectSchema.parse(JSON.parse(raw));
    } catch (error) {
      const backup = `${file}.bak`;
      try {
        const rawBackup = await fs.readFile(backup, 'utf8');
        const parsed = projectSchema.parse(JSON.parse(rawBackup));
        const corrupt = `${file}.corrupt-${Date.now()}`;
        try { await fs.rename(file, corrupt); } catch { /* original may not exist */ }
        await this.writeAtomic(id, parsed, false);
        await this.audit('recover-project', id, true);
        return parsed;
      } catch (backupError) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT' && (backupError as NodeJS.ErrnoException).code === 'ENOENT') {
          throw Object.assign(new Error(`项目 ${id} 不存在`), { status: 404, code: 'PROJECT_NOT_FOUND' });
        }
        throw Object.assign(new Error(`项目 ${id} 的数据无法读取或恢复`), { status: 500, code: 'PROJECT_CORRUPT', cause: error });
      }
    }
  }

  async create(project: Project): Promise<Project> {
    if (await this.exists(project.id)) throw Object.assign(new Error('项目已存在'), { status: 409, code: 'PROJECT_EXISTS' });
    return this.enqueue(project.id, async () => this.writeAtomic(project.id, projectSchema.parse(project), false));
  }

  async save(project: Project, expectedRevision: number): Promise<Project> {
    return this.enqueue(project.id, async () => {
      if (await this.exists(project.id)) {
        const current = await this.read(project.id);
        if (current.revision !== expectedRevision) throw new RevisionConflictError('项目已在其他页面更新，请刷新后重试');
        project.revision = current.revision + 1;
      }
      project.updatedAt = new Date().toISOString();
      return this.writeAtomic(project.id, projectSchema.parse(project), true);
    });
  }

  async delete(id: string): Promise<void> {
    assertSafeProjectId(id);
    const project = await this.read(id);
    const trash = safeResolve(this.dataDir, 'backups', `deleted-${id}-${Date.now()}`);
    await fs.rename(this.projectDir(id), trash);
    await this.audit('soft-delete-project', project.id, true);
  }

  async restore(project: Project): Promise<Project> {
    return this.enqueue(project.id,async()=>this.writeAtomic(project.id,projectSchema.parse(project),await this.exists(project.id)));
  }

  async writeAtomic(id: string, project: Project, makeBackup: boolean): Promise<Project> {
    const validated = projectSchema.parse(project);
    const dir = this.projectDir(id);
    const file = this.projectFile(id);
    const tmp = safeResolve(dir, `project.${process.pid}.${Date.now()}.tmp`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(tmp, `${JSON.stringify(validated, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    projectSchema.parse(JSON.parse(await fs.readFile(tmp, 'utf8')));
    if (makeBackup) {
      try { await fs.copyFile(file, `${file}.bak`); } catch { /* first save */ }
    }
    try {
      await fs.rename(tmp, file);
    } catch (error) {
      await fs.rm(tmp, { force: true });
      throw error;
    }
    await this.audit('write-project', id, true);
    return validated;
  }

  private enqueue<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(id) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    const tracked = next.finally(() => { if (this.queues.get(id) === tracked) this.queues.delete(id); });
    this.queues.set(id, tracked);
    return tracked;
  }

  async audit(action: string, projectId: string, ok: boolean): Promise<void> {
    const record = JSON.stringify({ at: new Date().toISOString(), action, projectId, ok, pid: process.pid });
    await fs.mkdir(safeResolve(this.dataDir, 'logs'), { recursive: true });
    await fs.appendFile(safeResolve(this.dataDir, 'logs', 'audit.ndjson'), `${record}\n`, 'utf8');
  }
}
