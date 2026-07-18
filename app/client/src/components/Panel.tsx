import type { ReactNode } from 'react';
export function Panel({title,subtitle,action,className='',children}:{title?:string;subtitle?:string;action?:ReactNode;className?:string;children:ReactNode}){return <section className={`panel ${className}`}><header className="panel-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</header>{children}</section>}
export function Empty({title='暂无数据',text='完成前置步骤后，这里会显示真实项目数据。'}:{title?:string;text?:string}){return <div className="empty-state"><span>◇</span><strong>{title}</strong><p>{text}</p></div>}
export function Loading(){return <div className="skeleton-grid" aria-label="正在加载"><i/><i/><i/><i/></div>}
export function Notice({type='info',children}:{type?:'info'|'warning'|'danger'|'success';children:ReactNode}){return <div className={`notice ${type}`}>{children}</div>}
