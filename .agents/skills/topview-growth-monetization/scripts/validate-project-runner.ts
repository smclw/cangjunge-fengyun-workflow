import fs from 'node:fs';
import { projectSchema } from '../../../../app/server/schemas/project.js';

const file=process.argv[2];
if(!file)throw new Error('缺少项目文件');
try{
  const project=projectSchema.parse(JSON.parse(fs.readFileSync(file,'utf8')));
  process.stdout.write(`${JSON.stringify({ok:true,id:project.id,revision:project.revision,updatedAt:project.updatedAt},null,2)}\n`);
}catch(error){
  const issues=error&&typeof error==='object'&&'issues' in error?(error as {issues:unknown}).issues:String(error);
  process.stderr.write(`${JSON.stringify({ok:false,issues},null,2)}\n`);
  process.exit(1);
}
