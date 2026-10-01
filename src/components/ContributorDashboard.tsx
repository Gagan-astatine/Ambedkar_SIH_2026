'use client';
import {useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,FilePlus2,ShieldCheck} from 'lucide-react';
import './contributor.css';
import './contributor-receipt.css';

const empty={title:'',source:'',rights:'',creator:'',description:'',language:''};
export default function ContributorDashboard(){
 const [email,setEmail]=useState(''),[fields,setFields]=useState(empty),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState<{recordId:string;title:string}|null>(null);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!file)return;
  setBusy(true);setError('');setReceipt(null);
  try{
   let count=0;
   if(file.name.toLowerCase().endsWith('.pdf')){const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;count=pdf.numPages;await pdf.cleanup()}
   const form=new FormData();form.set('file',file);form.set('email',email.trim());form.set('pageCount',String(count));for(const [key,value] of Object.entries(fields))form.set(key,value);
   const response=await fetch('/api/contributions',{method:'POST',body:form});const data=await response.json() as {document?:{recordId:string;title:string};exactDuplicate?:boolean;error?:string};
   if(response.status===409&&data.exactDuplicate)throw Error('This exact file has already been received.');
   if(!response.ok||!data.document)throw Error(data.error||'Upload failed.');
   setReceipt({recordId:data.document.recordId,title:data.document.title});setFields(empty);setFile(null);event.currentTarget.reset();
  }catch(issue){setError(issue instanceof Error?issue.message:'Upload failed.')}finally{setBusy(false)}
 }
 return <div className="contributor-shell"><header><a href="/" className="contributor-back"><ArrowLeft size={16}/> DIGITAL HERITAGE ARCHIVE</a></header><main><div className="contributor-intro"><span className="eyebrow">CONTRIBUTE A SOURCE</span><h1>Share an original source.</h1><p>Submit an archival PDF, image, audio or video with its known provenance. Your file is kept privately for processing; a submission does not add it to the public archive.</p></div><div className="contributor-grid"><section className="contributor-form"><h2><FilePlus2 size={21}/> New submission</h2><form onSubmit={submit}><label>Email address<input type="email" required autoComplete="email" maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/></label><small>Your email is recorded with this submission. Entering it does not create an account.</small><label>Original file<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.mp3,.wav,.mp4,.webm" required onChange={event=>setFile(event.target.files?.[0]||null)}/></label><small>Up to 20 MB. Keep the original file unchanged.</small><label>Title<input required minLength={3} maxLength={200} value={fields.title} onChange={event=>setFields({...fields,title:event.target.value})}/></label><label>Source or repository<input required value={fields.source} onChange={event=>setFields({...fields,source:event.target.value})}/></label><label>Rights or permission information<input required value={fields.rights} onChange={event=>setFields({...fields,rights:event.target.value})}/></label><div className="contributor-pair"><label>Creator, if known<input value={fields.creator} onChange={event=>setFields({...fields,creator:event.target.value})}/></label><label>Language<input value={fields.language} onChange={event=>setFields({...fields,language:event.target.value})}/></label></div><label>Context or description<textarea rows={3} value={fields.description} onChange={event=>setFields({...fields,description:event.target.value})}/></label><button className="primary-button" disabled={!file||busy}>{busy?'Uploading…':'Submit source'}<ArrowRight size={16}/></button></form>{error&&<p role="alert" className="contributor-error">{error}</p>}{receipt&&<div role="status" className="contributor-receipt"><strong>UNDER PROCESS</strong><p>{receipt.title} was received privately. It has not been published or added to search.</p><small>Submission reference: {receipt.recordId}</small></div>}</section><aside className="contributor-list"><h2><ShieldCheck size={21}/> What happens next</h2><p>We preserve the original file and its SHA-256 fingerprint as a private pending submission. Processing and publication require a separate review workflow; this form does not publish content.</p></aside></div></main></div>
}
