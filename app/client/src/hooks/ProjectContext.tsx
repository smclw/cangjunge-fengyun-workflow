import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../services/api';
import type { Dashboard, Project, ProjectSummary } from '../types';

interface State {projects:ProjectSummary[];project:Project|null;dashboard:Dashboard|null;activeId:string|null;loading:boolean;error:string;period:number;dateRange:{from:string;to:string}|null;setActive:(id:string)=>void;refresh:()=>Promise<void>;update:(changes:Record<string,unknown>)=>Promise<Project>;action:(name:string,payload?:Record<string,unknown>)=>Promise<Project>;setPeriod:(days:number)=>void;setDateRange:(from:string,to:string)=>void;}
const Context=createContext<State|null>(null);
export function ProjectProvider({children}:{children:ReactNode}){
  const [projects,setProjects]=useState<ProjectSummary[]>([]),[project,setProject]=useState<Project|null>(null),[dashboard,setDashboard]=useState<Dashboard|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[period,setPeriodValue]=useState(7),[dateRange,setDateRangeValue]=useState<{from:string;to:string}|null>(null);
  const [activeId,setActiveId]=useState<string|null>(()=>localStorage.getItem('topview-active-project'));
  const setActive=useCallback((id:string)=>{localStorage.setItem('topview-active-project',id);setActiveId(id);},[]);
  const refresh=useCallback(async()=>{setLoading(true);setError('');try{const list=await api.get<ProjectSummary[]>('/api/projects');setProjects(list);const id=activeId&&list.some((p)=>p.id===activeId)?activeId:list[0]?.id;if(id){if(id!==activeId)setActive(id);const query=dateRange?`from=${encodeURIComponent(dateRange.from)}&to=${encodeURIComponent(dateRange.to)}`:`days=${period}`;const [detail,board]=await Promise.all([api.get<Project>(`/api/projects/${id}`),api.get<Dashboard>(`/api/projects/${id}/dashboard?${query}`)]);setProject(detail);setDashboard(board);}else{setProject(null);setDashboard(null);}}catch(e){setError(e instanceof Error?e.message:'加载失败');}finally{setLoading(false);}},[activeId,period,dateRange,setActive]);
  useEffect(()=>{void refresh();},[refresh]);
  const update=useCallback(async(changes:Record<string,unknown>)=>{if(!project)throw new Error('当前没有项目');const saved=await api.patch<Project>(`/api/projects/${project.id}`,{expectedRevision:project.revision,changes});setProject(saved);await refresh();return saved;},[project,refresh]);
  const action=useCallback(async(name:string,payload:Record<string,unknown>={})=>{if(!project)throw new Error('当前没有项目');const saved=await api.post<Project>(`/api/projects/${project.id}/actions/${name}`,{expectedRevision:project.revision,...payload});setProject(saved);await refresh();return saved;},[project,refresh]);
  const setPeriod=useCallback((days:number)=>{setDateRangeValue(null);setPeriodValue(days);},[]);const setDateRange=useCallback((from:string,to:string)=>setDateRangeValue({from,to}),[]);
  const value=useMemo(()=>({projects,project,dashboard,activeId,loading,error,period,dateRange,setActive,refresh,update,action,setPeriod,setDateRange}),[projects,project,dashboard,activeId,loading,error,period,dateRange,setActive,refresh,update,action,setPeriod,setDateRange]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useProject(){const value=useContext(Context);if(!value)throw new Error('ProjectProvider missing');return value;}
