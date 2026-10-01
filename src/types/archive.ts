export type Category = 'Books'|'Manuscripts'|'Speeches'|'Photographs'|'Constitutional records'|'Documents'|'Audio'|'Video';
export interface MetadataRecord { id:string; title:string; creator:string; date:string|null; description:string; subject:string[]; language:string; collection:string; source:string|null; rights:string; location:string; relatedEntities:string[] }
export interface ArchiveDocument extends MetadataRecord { type:Category; provenance:'Source reference'|'Demo data'|'Supplied image'|'User-supplied PDF'; pages:number; tone:string; pdfUrl?:string; indexId?:string; sha256?:string; bytes?:number; extraction?:{native:number;ocr:number;unreadable:number} }
export interface Manuscript extends ArchiveDocument { type:'Manuscripts' }
export interface Speech extends ArchiveDocument { type:'Speeches' }
export interface Book extends ArchiveDocument { type:'Books' }
export interface AudioRecord extends ArchiveDocument { type:'Audio'; duration:number; url:string }
export interface VideoRecord extends ArchiveDocument { type:'Video'; duration:number; url:string }
export interface Person { id:string; name:string; source:string }
export interface Place { id:string; name:string }
export interface Topic { id:string; label:string }
export interface Event { id:string; date:string; title:string; description:string; topic:string; place:string; people:string[]; documents:string[]; source:string }
export interface KnowledgeGraphNode { id:string; label:string; type:string; x:number; y:number; description:string; documents:string[]; source:string|null }
export interface KnowledgeGraphEdge { from:string; to:string; relation:string; demo:boolean; source:string|null }
export interface PipelineStatus { stage:number; label:string; complete:boolean }
export interface SearchOptions { mode?:'Keyword'|'Semantic'|'Entity'; category?:string; date?:string }
export interface SearchService { search(query:string, options?:SearchOptions):ArchiveDocument[] }
export interface KnowledgeGraphService { nodes:KnowledgeGraphNode[]; edges:KnowledgeGraphEdge[] }
export interface N8nService { run(progress:(status:PipelineStatus)=>void, signal?:AbortSignal):Promise<void> }
export interface ArchiveService { documents:ArchiveDocument[]; events:Event[]; get(id:string):ArchiveDocument|undefined }
export interface MetadataService { export(format:'json'|'csv'):string }
export interface VoiceService { supported():boolean; listen(onText:(text:string)=>void,onState:(state:string)=>void,language:string):()=>void }
