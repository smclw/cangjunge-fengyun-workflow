import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, FolderKanban, Images, Box, Lightbulb, ScrollText, Clapperboard, CalendarDays, ChartNoAxesCombined, RefreshCcw, Settings, Menu, Bell, Bot } from 'lucide-react';
import { useProject } from '../hooks/ProjectContext';

const nav=[['/','首页仪表盘',LayoutDashboard],['/new','新建项目',PlusCircle],['/projects','项目列表',FolderKanban],['/materials','素材库',Images],['/products','产品库',Box],['/topics','选题库',Lightbulb],['/scripts','脚本库',ScrollText],['/topview','Topview制作包',Clapperboard],['/publishing','发布计划',CalendarDays],['/analytics','数据分析',ChartNoAxesCombined],['/review','复盘中心',RefreshCcw],['/settings','设置',Settings]] as const;

function GlobalErrorToast(){
  const [message,setMessage]=useState('');
  useEffect(()=>{
    const rejected=(event:PromiseRejectionEvent)=>{event.preventDefault();setMessage(event.reason instanceof Error?event.reason.message:'操作失败，请重试。');};
    const failed=(event:ErrorEvent)=>setMessage(event.error instanceof Error?event.error.message:event.message||'页面处理失败。');
    window.addEventListener('unhandledrejection',rejected);window.addEventListener('error',failed);
    return()=>{window.removeEventListener('unhandledrejection',rejected);window.removeEventListener('error',failed);};
  },[]);
  return message?<button className="toast error" onClick={()=>setMessage('')} aria-label="关闭错误提示">{message}（点击关闭）</button>:null;
}

export function AppShell(){
  const [collapsed,setCollapsed]=useState(false);
  const {project,projects,setActive,loading}=useProject();
  return <div className={`app-shell ${collapsed?'collapsed':''}`}>
    <GlobalErrorToast/>
    <aside className="sidebar"><div className="brand"><span className="brand-mark">◇</span><strong>沧钧阁</strong></div><button className="collapse" onClick={()=>setCollapsed(!collapsed)} aria-label="收起或展开侧栏"><Menu size={19}/></button><nav>{nav.map(([to,label,Icon])=><NavLink key={to} to={to} end={to==='/'} title={label}><Icon size={20}/><span>{label}</span></NavLink>)}</nav><div className="sidebar-card"><Bot/><span>本地工作流</span><small>数据只保存在本机</small></div></aside>
    <div className="workspace"><header className="topbar"><div><h1>沧钧阁 · 风云化金工作流</h1><p>智能选题 · 脚本生成 · 制作包 · 发布 · 数据复盘</p></div><div className="topbar-tools"><select aria-label="当前项目" value={project?.id??''} onChange={(event)=>setActive(event.target.value)} disabled={loading}>{projects.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="status-dot">● 本地运行</span><button className="icon-button" aria-label="消息提醒"><Bell size={19}/><b>1</b></button><span className="assistant"><Bot size={18}/> 运营小助手</span></div></header><main><Outlet/></main></div>
  </div>;
}
