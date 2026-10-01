'use client';
import type {ReactNode} from 'react';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {ArrowUpRight} from 'lucide-react';
export function Choice({value,onChange,options,label}:{value:string;onChange:(value:string)=>void;options:string[];label:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger className="choice" aria-label={label}><SelectValue/></SelectTrigger><SelectContent className="choice-menu">{options.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>}
export function Wheel({className=''}:{className?:string}){return <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true"><circle cx="50" cy="50" r="45"/><circle cx="50" cy="50" r="6"/>{Array.from({length:24},(_,i)=>{const a=i*Math.PI/12;return <line key={i} x1={(50+6*Math.sin(a)).toFixed(4)} y1={(50+6*Math.cos(a)).toFixed(4)} x2={(50+45*Math.sin(a)).toFixed(4)} y2={(50+45*Math.cos(a)).toFixed(4)}/>})}</svg>}
export function SectionHeading({number,kicker,title,children}:{number:string;kicker:string;title:string;children?:ReactNode}){return <div className="section-heading"><div><p className="eyebrow"><span>{number}</span>{kicker}</p><h2>{title}</h2></div>{children&&<div className="section-intro">{children}</div>}</div>}
export function SourceLink({url,children='View original source'}:{url:string;children?:ReactNode}){return <a className="text-link" href={url} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={15}/></a>}
