import { useMemo, useState } from 'react';
import { Sparkles, Filter, Download, ScrollText } from 'lucide-react';
import { useProject } from '../hooks/ProjectContext';
import { PageHeader, StatusBadge, Toast } from '../components/PageParts';
import { Empty, Notice, Panel } from '../components/Panel';

export function TopicsPage(){
  const {project,action}=useProject();
  const [min,setMin]=useState(0),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const topics=useMemo(()=>project?.topics.filter((topic)=>topic.compositeScore>=min).sort((a,b)=>b.compositeScore-a.compositeScore)??[],[project,min]);
  if(!project)return <Empty title="请先选择项目"/>;
  const run=async(name:string,label:string)=>{setBusy(true);try{await action(name);setMessage(`${label}完成并已保存。`);}catch(error){setMessage(error instanceof Error?error.message:'生成失败');}finally{setBusy(false);}};
  return <div>
    <PageHeader title="选题库" description="按产品批量生成、服务端评分、风险硬阻断、筛选和创建脚本。" actions={<><button className="primary-button" onClick={()=>void run('generate-topics',`${project.products.length*4}个选题生成与评分`)} disabled={busy}><Sparkles/> 生成并评分</button><button className="ghost-button" onClick={()=>void run('generate-scripts','三套脚本生成')} disabled={busy}><ScrollText/> 创建三套脚本</button><a className="ghost-button" href={`/api/projects/${project.id}/export`}><Download/> 导出</a></>}/>
    <Toast message={message} type={message.includes('失败')||message.includes('请先')?'error':'success'}/>
    <Notice>综合分与明细均由 config/scoring.json 驱动；发布硬阻断与风险扣分分开处理。风险项同时给出原因、合规改写与所需证据。</Notice>
    <Panel title="优先选题" subtitle={`${topics.length} / ${project.topics.length} 个`} action={<label className="range-filter"><Filter/> 最低综合分 <input type="range" min="0" max="100" value={min} onChange={(event)=>setMin(Number(event.target.value))}/><b>{min}</b></label>}>
      {topics.length?<div className="data-table-wrap"><table><thead><tr><th>选题</th><th>内容类型</th><th>产品/平台</th><th>涨粉分</th><th>变现分</th><th>风险</th><th>综合分</th><th>脚本角度</th><th>状态</th></tr></thead><tbody>{topics.map((topic)=><tr key={topic.id}>
        <td><strong>{topic.name}</strong>{topic.publishBlocked&&<StatusBadge tone="red">禁止发布</StatusBadge>}</td><td>{topic.contentType}</td><td>{String(project.products.find((product)=>String(product.id)===topic.productId)?.name??topic.productId)}<small>{topic.platform}</small></td><td><span className="score growth">{topic.growthScore}</span></td><td><span className="score money">{topic.monetizationScore}</span></td><td><span className={`score ${topic.riskPenalty?'risk':''}`}>-{topic.riskPenalty}</span>{topic.risks.length>0&&<details><summary>查看处置</summary>{topic.risks.map((risk)=><p key={risk}>{risk}</p>)}</details>}</td><td><div className="score-bar"><i style={{width:`${Math.max(0,topic.compositeScore)}%`}}/><b>{topic.compositeScore}</b></div></td><td>{topic.angle}</td><td><StatusBadge tone={topic.status==='recommended'?'green':'blue'}>{topic.status}</StatusBadge></td>
      </tr>)}</tbody></table></div>:<Empty title="暂无选题" text="先录入产品，再点击“生成并评分”。"/>}
    </Panel>
  </div>;
}
