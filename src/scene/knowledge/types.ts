export type SourceReference = {documentId:string;pageNumber:number;pageId:string;sourceText:string;method:string};
export type GraphEntity = {id:string;label:string;type:string;mentionCount:number;documentCount?:number;pageCount?:number;sources:SourceReference[]};
export type GraphRelationship = {source:string;target:string;relation:string;count:number;sources:SourceReference[]};
export type GraphCommand = {kind:'reset'|'focus'|'connections'|'in'|'out';sequence:number};
export const entityColors:Record<string,string>={DOCUMENT:'#b9a787',PERSON:'#dec495',TOPIC:'#79a6ad',PLACE:'#bc937e',INSTITUTION:'#aaa7bd','EVENT REFERENCE':'#b497a9',WORK:'#9ead92',BOOK:'#b9a787',AUDIO:'#8eaaa9',VIDEO:'#8eaaa9'};
