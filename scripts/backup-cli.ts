import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackup } from '../app/server/services/backup-service.js';
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=await createBackup(projectRoot,path.join(projectRoot,'data'),path.join(projectRoot,'config'));
console.log(`备份完成：${output}`);
