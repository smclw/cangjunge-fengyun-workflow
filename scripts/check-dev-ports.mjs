import net from 'node:net';

const ports=[4173,5173];
const busy=[];

for(const port of ports){
  if(!await available(port))busy.push(port);
}

if(busy.length){
  console.error(`[dev] 端口 ${busy.join('、')} 已被占用。请先关闭占用程序，再运行 npm run dev。`);
  process.exit(1);
}

function available(port){
  return new Promise((resolve)=>{
    const server=net.createServer();
    server.once('error',()=>resolve(false));
    server.once('listening',()=>server.close(()=>resolve(true)));
    server.listen(port,'127.0.0.1');
  });
}
