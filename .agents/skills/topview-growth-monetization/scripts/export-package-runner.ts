import fs from 'node:fs';
import { projectSchema } from '../../../../app/server/schemas/project.js';
import { exportProjectFiles } from '../../../../app/server/services/export-service.js';

const [input,output]=process.argv.slice(2);
if(!input||!output)throw new Error('缺少项目文件或输出目录');
const project=projectSchema.parse(JSON.parse(fs.readFileSync(input,'utf8')));
const files=await exportProjectFiles(project,output);
process.stdout.write(`${JSON.stringify({ok:true,files:files.length,output},null,2)}\n`);
