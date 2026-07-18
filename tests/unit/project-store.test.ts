import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach,describe,expect,it } from 'vitest';
import { ProjectStore } from '../../app/server/storage/project-store.js';
import { makeTemp,testProject } from '../helpers.js';
const roots:string[]=[];afterEach(async()=>{await Promise.all(roots.splice(0).map((root)=>fs.rm(root,{recursive:true,force:true})));});
describe('ProjectStore',()=>{
  it('写入可恢复、保留修订备份并隔离损坏主文件',async()=>{const root=await makeTemp();roots.push(root);const store=new ProjectStore(root);const project=testProject();await store.create(project);project.summary='第二版';const saved=await store.save(project,0);expect(saved.revision).toBe(1);await fs.writeFile(store.projectFile(project.id),'{bad json','utf8');const recovered=await store.read(project.id);expect(recovered.revision).toBe(0);expect((await fs.readdir(path.dirname(store.projectFile(project.id)))).some((x)=>x.includes('.corrupt-'))).toBe(true);});
  it('并发更新中只有匹配 revision 的一次成功',async()=>{const root=await makeTemp();roots.push(root);const store=new ProjectStore(root);const project=testProject();await store.create(project);const one=structuredClone(project),two=structuredClone(project);one.summary='one';two.summary='two';const results=await Promise.allSettled([store.save(one,0),store.save(two,0)]);expect(results.filter((x)=>x.status==='fulfilled')).toHaveLength(1);expect(results.filter((x)=>x.status==='rejected')).toHaveLength(1);});
  it('不存在项目返回可区分的404',async()=>{const root=await makeTemp();roots.push(root);const store=new ProjectStore(root);await expect(store.read('missing-project')).rejects.toMatchObject({status:404,code:'PROJECT_NOT_FOUND'});});
});
