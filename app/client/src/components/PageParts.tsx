import type { ReactNode } from 'react';
export function PageHeader({eyebrow='工作流操作台',title,description,actions}:{eyebrow?:string;title:string;description:string;actions?:ReactNode}){return <div className="page-header"><div><small>{eyebrow}</small><h2>{title}</h2><p>{description}</p></div><div className="page-actions">{actions}</div></div>}
export function Field({label,hint,required,children}:{label:string;hint?:string;required?:boolean;children:ReactNode}){return <label className="field"><span>{label}{required&&<b> *</b>}</span>{children}{hint&&<small>{hint}</small>}</label>}
export function StatusBadge({children,tone='blue'}:{children:ReactNode;tone?:'blue'|'green'|'orange'|'red'|'gray'}){return <span className={`badge ${tone}`}>{children}</span>}
export function Toast({message,type='success'}:{message:string;type?:'success'|'error'}){return message?<div className={`toast ${type}`}>{message}</div>:null}
