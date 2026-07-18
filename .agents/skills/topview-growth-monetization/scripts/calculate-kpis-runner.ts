import fs from 'node:fs';
import { metricValuesSchema } from '../../../../app/server/schemas/project.js';
import { calculateKpis } from '../../../../app/server/analytics/kpis.js';

const file=process.argv[2];
if(!file)throw new Error('缺少指标文件');
const values=metricValuesSchema.parse(JSON.parse(fs.readFileSync(file,'utf8')));
process.stdout.write(`${JSON.stringify(calculateKpis(values),null,2)}\n`);
