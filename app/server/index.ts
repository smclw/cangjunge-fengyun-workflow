import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { createApp } from './app.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const projectRoot=path.resolve(here,'../..');
const args=process.argv.slice(2);
const getArg=(name:string)=>{const index=args.indexOf(name);return index>=0?args[index+1]:undefined;};
const requestedPort=Number(getArg('--port')??process.env.PORT??4173);
const strictPort=args.includes('--strict-port');
const dataDir=path.resolve(projectRoot,getArg('--data-dir')??'data');
const port=await findPort(requestedPort,strictPort?requestedPort:requestedPort+26);
const {app}=await createApp({projectRoot,dataDir,configDir:path.join(projectRoot,'config'),staticDir:path.join(projectRoot,'app/client/dist')});
const server=app.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({ok:true,url:`http://127.0.0.1:${port}`,pid:process.pid,dataDir})));
const shutdown=()=>server.close(()=>process.exit(0));process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);

async function findPort(start:number,end:number):Promise<number>{for(let port=start;port<=end;port++){if(await available(port))return port;}throw new Error(start===end?`端口 ${start} 已被占用`:`端口 ${start}-${end} 均被占用`);}
function available(port:number):Promise<boolean>{return new Promise((resolve)=>{const s=net.createServer();s.once('error',()=>resolve(false));s.once('listening',()=>s.close(()=>resolve(true)));s.listen(port,'127.0.0.1');});}
