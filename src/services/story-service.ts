import {researchArchive} from './archive-retrieval';
import {hybridFrameSearch,loadFrames,frameImageUrl} from './frames';
import {model,manifest,volume} from '@/src/knowledge/semantic';
import type {Language} from '@/src/config/i18n';

export type StorySource={documentId:string;title:string;page:number;url:string;sha256?:string;method:string;excerpt:string;kind:'PDF'|'MEDIA';timestamp?:number};
export type StoryChapter={id:string;title:string;body:string;paragraphs:string[];source:StorySource;people:string[];places:string[];topics:string[];visual:'image'|'document';image?:{url:string;alt:string;sourceUrl:string;caption:string}};
export type ArchiveStoryRecord={storyId:string;title:string;language:Language;query:string;kind:string;introduction:string;sourceDocuments:string[];sourcePages:{documentId:string;page:number}[];chapters:StoryChapter[];media:string[];generatedAt:string;generationStatus:'READY';reviewStatus:'PENDING'|'APPROVED'|'UNPUBLISHED';conclusion:string;estimatedMinutes:number};
export type StoryLength='short'|'medium'|'deep';
type Candidate={documentId:string;pageNumber:number;document:{title:string};citation:{sha256?:string};method:string;excerpt:string};

// Sequence only statements present in indexed pages. The connective narration
// describes the reader's path through evidence, never a new historical event.
function sentences(text:string){return text.split('\n').filter(line=>!/DR\. BABASAHEB AMBEDKAR\s*:\s*WRITINGS AND SPEECHES/i.test(line)&&!/^[A-Z][A-Z .]{8,}\s+\d+\s*$/.test(line)&&!/^\s*[A-Z][A-Z\s]{6,}\s*$/.test(line)).join(' ').replace(/\s+/g,' ').match(/[^.!?।]+[.!?।]+|[^.!?।]+$/g)?.map(s=>s.trim()).filter(s=>s.length>38&&s.length<360&&/^[“"(]?[A-Z]/.test(s)&&!/^([.\d]|ignore|system:|assistant:)/i.test(s))||[]}
function passageFromPage(text:string,query:string){const candidates=sentences(text);const terms=query.toLowerCase().match(/[a-z]{4,}/g)||[];return candidates.map((sentence,index)=>({sentence,index,score:terms.reduce((n,term)=>n+(sentence.toLowerCase().includes(term)?1:0),0)})).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,2).sort((a,b)=>a.index-b.index).map(item=>item.sentence)}
const words={English:{title:'The story of',intro:'Let us follow the surviving pages, one scene at a time.',begin:'Let us begin with a page in the archive.',middle:'Now the record takes us a little further.',turn:'A new page adds another part of the picture.',last:'Before we leave, there is one more detail to consider.',look:'Listen to what this page preserves:',next:'This detail sits beside it:',conclusion:'The pages together offer a way to explore this history. Open the original sources to see the full context; this account is an unreviewed interpretation of the indexed record.'},'हिन्दी':{title:'इस विषय की कहानी:',intro:'आइए, बचे हुए दस्तावेज़ों को एक-एक दृश्य में देखें।',begin:'कहानी अभिलेख के एक पृष्ठ से शुरू होती है।',middle:'अब अगला पृष्ठ हमें आगे ले जाता है।',turn:'एक और पृष्ठ इस विषय का दूसरा पक्ष दिखाता है।',last:'अंत में, एक और विवरण पर ध्यान दें।',look:'इस पृष्ठ में दर्ज है:',next:'इसके साथ यह विवरण भी मिलता है:',conclusion:'ये पृष्ठ इस इतिहास को समझने की शुरुआत हैं। पूरा संदर्भ जानने के लिए मूल स्रोत खोलें। यह अनुक्रमित स्रोतों पर आधारित, समीक्षा के लिए लंबित विवरण है।'},'ಕನ್ನಡ':{title:'ಈ ವಿಷಯದ ಕಥೆ:',intro:'ಉಳಿದಿರುವ ದಾಖಲೆಗಳ ಪುಟಗಳನ್ನು ಒಂದೊಂದು ದೃಶ್ಯವಾಗಿ ನೋಡೋಣ.',begin:'ಕಥೆ ದಾಖಲೆಯ ಒಂದು ಪುಟದಿಂದ ಆರಂಭವಾಗುತ್ತದೆ.',middle:'ಈಗ ಮುಂದಿನ ಪುಟ ನಮ್ಮನ್ನು ಮುಂದೆ ಕರೆದೊಯ್ಯುತ್ತದೆ.',turn:'ಮತ್ತೊಂದು ಪುಟ ಈ ವಿಷಯದ ಇನ್ನೊಂದು ಭಾಗವನ್ನು ತೋರಿಸುತ್ತದೆ.',last:'ಕೊನೆಯಲ್ಲಿ ಇನ್ನೊಂದು ವಿವರವನ್ನು ಗಮನಿಸೋಣ.',look:'ಈ ಪುಟದಲ್ಲಿ ಹೀಗೆ ದಾಖಲಾಗಿದೆ:',next:'ಇದರ ಜೊತೆಗೆ ಮತ್ತೊಂದು ವಿವರ ಇದೆ:',conclusion:'ಈ ಪುಟಗಳು ಇತಿಹಾಸವನ್ನು ತಿಳಿಯಲು ಆರಂಭವಾಗಿವೆ. ಸಂಪೂರ್ಣ ಸಂದರ್ಭಕ್ಕಾಗಿ ಮೂಲ ದಾಖಲೆಗಳನ್ನು ತೆರೆಯಿರಿ. ಈ ಕಥೆ ಸೂಚ್ಯಂಕಿತ ಮೂಲಗಳಿಂದ ಸಿದ್ಧವಾಗಿದೆ; ಇನ್ನೂ ಪರಿಶೀಲಿಸಿಲ್ಲ.'}} as const;

export async function generateStory(query:string,kind:string,language:Language,onStatus:(label:string)=>void,length:StoryLength='medium'):Promise<ArchiveStoryRecord>{
 const term=query.trim();if(term.length<3||term.length>150)throw Error('Choose a person, topic, period or source from the archive.');
 const response=await researchArchive(term,s=>onStatus(s.label));
 const sources=await manifest();const selectedDocument=kind==='document'?sources.find(d=>d.title===term):undefined;
 const hits=response.results.filter(h=>['HIGH SOURCE SUPPORT','MODERATE SOURCE SUPPORT'].includes(h.support))
  .filter(h=>h.documentId&&!h.documentId.startsWith('DOC-')&&h.pageNumber>0&&h.citation.sha256)
  .filter(h=>!selectedDocument||h.documentId===selectedDocument.id);
 const count=length==='short'?3:length==='deep'?8:5;
 const unique:Candidate[]=hits.filter((h,i,all)=>all.findIndex(x=>x.documentId===h.documentId&&x.pageNumber===h.pageNumber)===i).slice(0,count);
 if(selectedDocument&&unique.length<2){
  const indexed=(await volume(selectedDocument.id)).pages;
  const start=indexed.findIndex(page=>page.pageNumber>15&&page.text.length>900&&/^[A-Z][A-Z\s]{8,}/.test(page.text.trim()));
  if(start>=0){for(const page of indexed.slice(start,start+count+2).filter(p=>passageFromPage(p.text,term).length).slice(0,count)){
   unique.push({documentId:selectedDocument.id,pageNumber:page.pageNumber,document:selectedDocument,citation:{sha256:selectedDocument.sha256},method:page.method,excerpt:page.text.slice(0,500)});
  }}
 }
 if(unique.length<2)throw Error('Not enough verified pages connect to this subject. Try a narrower source or topic.');
 if(selectedDocument)unique.sort((a,b)=>a.pageNumber-b.pageNumber);
 const pages=new Map(await Promise.all([...new Set(unique.map(h=>h.documentId))].map(async id=>[id,(await volume(id)).pages] as const)));
 const usable=unique.filter(h=>passageFromPage(pages.get(h.documentId)?.[h.pageNumber-1]?.text||h.excerpt,term).length);
 if(usable.length<2)throw Error('The indexed pages do not have enough readable passages for a story.');
 let frames:Awaited<ReturnType<typeof loadFrames>>=[];try{frames=hybridFrameSearch(await loadFrames(),term,await model()).slice(0,4)}catch{}
 const t=words[language];
 const chapters:StoryChapter[]=usable.map((hit,i)=>{
  const page=pages.get(hit.documentId)?.[hit.pageNumber-1];const lines=passageFromPage(page?.text||hit.excerpt,term);const first=lines[0],second=lines[1];
  const source:StorySource={documentId:hit.documentId,title:hit.document.title,page:hit.pageNumber,url:`/api/archive/supplied?documentId=${encodeURIComponent(hit.documentId)}#page=${hit.pageNumber}`,sha256:hit.citation.sha256,method:hit.method,excerpt:hit.excerpt,kind:'PDF'};
  const image=frames.find(frame=>frame.source_page_url&&[frame.title,...(frame.topics||[])].some(value=>term.toLowerCase().split(/\s+/).some(word=>word.length>4&&value.toLowerCase().includes(word))));
  const lead=i===0?t.begin:i===usable.length-1?t.last:i===Math.floor(usable.length/2)?t.turn:t.middle;
  const paragraphs=[lead,`${t.look} “${first}”`,...(second?[`${t.next} “${second}”`]:[])];
  return {id:`${hit.documentId}-p${hit.pageNumber}`,title:hit.document.title.replace(/ · supplied PDF$/,''),body:paragraphs.join('\n\n'),paragraphs,source,people:response.analysis.entities.filter(e=>/person/i.test(e.type)).map(e=>e.label).slice(0,3),places:response.analysis.entities.filter(e=>/place|location/i.test(e.type)).map(e=>e.label).slice(0,2),topics:response.analysis.entities.filter(e=>/topic|concept|event/i.test(e.type)).map(e=>e.label).slice(0,3),visual:image&&i%2===0?'image':'document',...(image&&i%2===0?{image:{url:frameImageUrl(image),alt:image.alt_text||image.title,sourceUrl:image.source_page_url,caption:image.title}}:{})};
 });
 const totalWords=chapters.reduce((n,c)=>n+c.paragraphs.join(' ').split(/\s+/).length,0);
 return {storyId:`STORY-${crypto.randomUUID()}`,title:`${t.title} ${term}`,language,query:term,kind,introduction:t.intro,sourceDocuments:[...new Set(chapters.map(c=>c.source.documentId))],sourcePages:chapters.map(c=>({documentId:c.source.documentId,page:c.source.page})),chapters,media:chapters.flatMap(c=>c.image?[c.image.sourceUrl]:[]),generatedAt:new Date().toISOString(),generationStatus:'READY',reviewStatus:'PENDING',conclusion:t.conclusion,estimatedMinutes:Math.max(1,Math.ceil(totalWords/140))};
}
