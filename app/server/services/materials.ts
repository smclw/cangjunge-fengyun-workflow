import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { materialSchema, type Project } from '../schemas/project.js';
import { safeResolve, safeStoredName } from '../utils/paths.js';

const mimeByExt: Record<string,string[]> = {
  '.png':['image/png'],'.jpg':['image/jpeg'],'.jpeg':['image/jpeg'],'.webp':['image/webp'],'.mp4':['video/mp4'],'.mov':['video/quicktime'],
  '.pdf':['application/pdf'],'.doc':['application/msword','application/octet-stream'],'.docx':['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip','application/octet-stream'],
  '.xls':['application/vnd.ms-excel','application/octet-stream'],'.xlsx':['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip','application/octet-stream'],
  '.csv':['text/csv','application/vnd.ms-excel','text/plain'],'.txt':['text/plain'],'.md':['text/markdown','text/plain']
};

function basicSignatureOk(ext:string,buffer:Buffer):boolean {
  if (buffer.length === 0) return false;
  if (ext === '.png') return buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (['.jpg','.jpeg'].includes(ext)) return buffer[0]===0xff&&buffer[1]===0xd8;
  if (ext === '.pdf') return buffer.subarray(0,5).toString()==='%PDF-';
  if (['.docx','.xlsx'].includes(ext)) return buffer[0]===0x50&&buffer[1]===0x4b;
  if (ext === '.mp4') return buffer.subarray(4,8).toString()==='ftyp';
  return true;
}

export async function saveMaterial(project:Project,file:Express.Multer.File,meta:{type:string;source:string;authorization:string;commercialUseAllowed:boolean},dataDir:string,allowedExtensions:string[]) {
  const ext=path.extname(file.originalname).toLowerCase();
  if(!allowedExtensions.includes(ext)||['.html','.htm','.svg','.js','.exe','.bat','.cmd','.ps1'].includes(ext)) throw Object.assign(new Error('不支持或不安全的文件类型'),{status:400,code:'UNSAFE_FILE_TYPE'});
  if(!mimeByExt[ext]?.includes(file.mimetype)) throw Object.assign(new Error('文件扩展名与内容类型不匹配'),{status:400,code:'MIME_MISMATCH'});
  if(!basicSignatureOk(ext,file.buffer)) throw Object.assign(new Error('文件内容签名与扩展名不匹配或文件为空'),{status:400,code:'SIGNATURE_MISMATCH'});
  const storedName=safeStoredName(file.originalname);
  const material=materialSchema.parse({
    id:crypto.randomUUID(),name:file.originalname,storedName,type:meta.type,source:meta.source,
    authorization:meta.authorization,uploadedAt:new Date().toISOString(),isOriginal:true,
    commercialUseAllowed:meta.commercialUseAllowed,aiAnalysis:'文件已安全保存；内容分析需用户明确触发，原文件不会被覆盖。',size:file.size,
    sha256:crypto.createHash('sha256').update(file.buffer).digest('hex')
  });
  const dir=safeResolve(dataDir,'projects',project.id,'materials');
  await fs.mkdir(dir,{recursive:true});
  const target=safeResolve(dir,storedName);
  await fs.writeFile(target,file.buffer,{flag:'wx'});
  return material as Project['materials'][number];
}
