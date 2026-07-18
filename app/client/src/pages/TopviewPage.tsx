import { useState } from 'react';
import { Sparkles, Copy, Download, FolderOpen, CheckCircle2 } from 'lucide-react';
import { useProject } from '../hooks/ProjectContext';
import { api } from '../services/api';
import { PageHeader, StatusBadge, Toast } from '../components/PageParts';
import { Empty, Notice, Panel } from '../components/Panel';

type PackageView={id:string;scriptId:string;chinesePrompt:string;englishPrompt:string;concisePrompt:string;narration:string;scenes:string[];uploadOrder:string[];avatarSuggestion:string;voiceSuggestion:string;subtitleSuggestion:string;bgmSuggestion:string;aspectRatio:string;durationSeconds:number;negativePrompt:string;variants:string[];exportChecklist:string[];completedChecklist:string[];enteredTopview:boolean};

function formatPackage(value:PackageView,markdown:boolean){
  const title=markdown?'# Topview 制作包\n\n':'';
  return `${title}中文完整提示词\n${value.chinesePrompt}\n\nEnglish Prompt\n${value.englishPrompt}\n\n精简提示词\n${value.concisePrompt}\n\n完整口播\n${value.narration}\n\n分镜\n${value.scenes.map((scene,index)=>`${index+1}. ${scene}`).join('\n')}\n\n上传素材顺序\n${value.uploadOrder.map((item,index)=>`${index+1}. ${item}`).join('\n')}\n\n执行参数\n- AI人物：${value.avatarSuggestion}\n- 声音：${value.voiceSuggestion}\n- 字幕：${value.subtitleSuggestion}\n- BGM：${value.bgmSuggestion}\n- 画幅：${value.aspectRatio}\n- 时长：${value.durationSeconds}秒\n\n负面限制词\n${value.negativePrompt}\n\nA/B变体\n${value.variants.map((item,index)=>`${index+1}. ${item}`).join('\n')}\n\n导出检查清单\n${value.exportChecklist.map((item)=>`- [ ] ${item}`).join('\n')}\n`;
}

export function TopviewPage(){
  const {project,action,update}=useProject();
  const [message,setMessage]=useState(''),[selected,setSelected]=useState(0),[busy,setBusy]=useState(false);
  if(!project)return <Empty title="请先选择项目"/>;
  const packages=project.topviewPackages as unknown as PackageView[],current=packages[selected];
  const generate=async()=>{setBusy(true);try{await action('generate-topview');setMessage('制作包已生成；没有调用Topview付费接口。');}catch(error){setMessage(error instanceof Error?error.message:'生成失败');}finally{setBusy(false);}};
  const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);setMessage('已复制到剪贴板。');}catch(error){setMessage(error instanceof Error?error.message:'复制失败');}};
  const download=(extension:'txt'|'md')=>{if(!current)return;const anchor=document.createElement('a');anchor.href=URL.createObjectURL(new Blob([formatPackage(current,extension==='md')],{type:'text/plain;charset=utf-8'}));anchor.download=`Topview制作包-${selected+1}.${extension}`;anchor.click();URL.revokeObjectURL(anchor.href);setMessage('完整制作包已导出。');};
  const mark=async()=>{if(!current)return;setBusy(true);try{await update({topviewPackages:packages.map((item)=>item.id===current.id?{...item,enteredTopview:true}:item)});setMessage('已标记进入人工Topview制作。');}catch(error){setMessage(error instanceof Error?error.message:'标记失败');}finally{setBusy(false);}};
  const toggleChecklist=async(item:string,checked:boolean)=>{if(!current)return;const completed=checked?[...new Set([...current.completedChecklist,item])]:current.completedChecklist.filter((value)=>value!==item);setBusy(true);try{await update({topviewPackages:packages.map((value)=>value.id===current.id?{...value,completedChecklist:completed}:value)});setMessage('人工操作状态已保存。');}catch(error){setMessage(error instanceof Error?error.message:'清单保存失败');}finally{setBusy(false);}};
  const open=async()=>{try{await api.post(`/api/projects/${project.id}/open-materials`,{});setMessage('已请求打开本项目素材文件夹。');}catch(error){setMessage(error instanceof Error?error.message:'打开失败');}};
  return <div>
    <PageHeader title="Topview制作包" description="制作指令可复制、完整导出和进入人工关卡；第一阶段不登录、不付费、不正式生成。" actions={<button className="primary-button" disabled={busy} onClick={()=>void generate()}><Sparkles/> {busy?'处理中…':'生成制作包'}</button>}/>
    <Toast message={message} type={/失败|拒绝|请先/.test(message)?'error':'success'}/><Notice type="warning">付费生成、正式导出、Topview 登录和对外发布都需要你在外部界面明确执行。</Notice>
    {packages.length&&current?<><div className="tab-row">{packages.map((item,index)=><button className={index===selected?'active':''} onClick={()=>setSelected(index)} key={item.id}>制作包 {index+1} {item.enteredTopview&&'✓'}</button>)}</div><div className="topview-layout">
      <Panel title="中文完整提示词" subtitle={`${current.aspectRatio} · ${current.durationSeconds}秒`} action={<button className="icon-text" onClick={()=>void copy(current.chinesePrompt)}><Copy/> 复制</button>}><pre className="prompt-box">{current.chinesePrompt}</pre><h4>精简提示词</h4><p>{current.concisePrompt}</p><h4>英文完整提示词</h4><pre className="prompt-box compact">{current.englishPrompt}</pre></Panel>
      <Panel title="执行参数" subtitle="按顺序准备材料"><h4>上传素材顺序</h4><ol className="number-list">{current.uploadOrder.map((item)=><li key={item}>{item}</li>)}</ol><div className="spec-list"><p><span>AI人物</span>{current.avatarSuggestion}</p><p><span>声音</span>{current.voiceSuggestion}</p><p><span>字幕</span>{current.subtitleSuggestion}</p><p><span>BGM</span>{current.bgmSuggestion}</p></div><h4>完整口播</h4><p>{current.narration}</p><h4>分镜</h4><ol>{current.scenes.map((scene)=><li key={scene}>{scene}</li>)}</ol><h4>负面限制词</h4><div className="risk-box">{current.negativePrompt}</div></Panel>
      <Panel title="16步人工操作清单" subtitle={`${current.completedChecklist.length} / ${current.exportChecklist.length} 已完成，刷新后保留`}><div className="check-list static">{current.exportChecklist.map((item)=><label key={item}><input type="checkbox" disabled={busy} checked={current.completedChecklist.includes(item)} onChange={(event)=>void toggleChecklist(item,event.target.checked)}/><span>{item}</span></label>)}</div><div className="button-stack"><button className="ghost-button" onClick={()=>download('txt')}><Download/> 导出TXT</button><button className="ghost-button" onClick={()=>download('md')}><Download/> 导出Markdown</button><button className="ghost-button" onClick={()=>void open()}><FolderOpen/> 打开素材文件夹</button><button className="primary-button" disabled={busy} onClick={()=>void mark()}><CheckCircle2/> 标记已进入Topview</button></div>{current.enteredTopview&&<StatusBadge tone="green">已进入人工制作</StatusBadge>}</Panel>
    </div></>:<Empty title="尚无制作包" text="先生成三类脚本，再点击“生成制作包”。"/>}
  </div>;
}
