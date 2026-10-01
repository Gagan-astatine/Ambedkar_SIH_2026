#!/usr/bin/env python3
"""Build a browsable graph of literal mentions with page-level provenance."""
import gzip,json,re
from collections import defaultdict
from pathlib import Path

root=Path(__file__).resolve().parents[1]/'public/corpus'
docs=json.loads((root/'manifest.json').read_text())
doc_ids={doc['id'] for doc in docs}
terms={
 'Dr. B. R. Ambedkar':('PERSON',r'\b(?:Dr\.?\s*)?(?:B\.?\s*R\.?\s*|Babasaheb\s*)?Ambedkar\b'),
 'Mahatma Gandhi':('PERSON',r'\b(?:Mahatma\s+)?Gandhi\b'),
 'Jawaharlal Nehru':('PERSON',r'\b(?:Jawaharlal\s+)?Nehru\b'),
 'Constituent Assembly':('INSTITUTION',r'\bConstituent Assembly\b'),
 'Round Table Conference':('EVENT REFERENCE',r'\bRound Table Conferences?\b'),
 'Education':('TOPIC',r'\beducation(?:al)?\b'),
 'Labour':('TOPIC',r'\blabou?r\b'),
 'Constitutional safeguards':('TOPIC',r'\bconstitutional safeguards?\b'),
 'Fundamental rights':('TOPIC',r'\bfundamental rights?\b'),
 'Social democracy':('TOPIC',r'\bsocial democracy\b'),
 'Caste':('TOPIC',r'\bcaste\b'),
 'Representation':('TOPIC',r'\brepresentation\b'),
 'Buddhism':('TOPIC',r'\bBuddhis(?:m|t)\b'),
 'Women':('TOPIC',r'\bwomen\b'),
 'Economics':('TOPIC',r'\beconomics?\b'),
 'Religion':('TOPIC',r'\breligion\b'),
 'Democracy':('TOPIC',r'\bdemocracy\b'),
 'Untouchability':('TOPIC',r'\buntouchab(?:ility|les?)\b'),
 'Hindu Code Bill':('WORK',r'\bHindu Code Bill\b'),
 'Mahad':('PLACE',r'\bMahad\b'),
 'Mumbai / Bombay':('PLACE',r'\b(?:Bombay|Mumbai)\b'),
 'Nagpur':('PLACE',r'\bNagpur\b'),
 'Delhi':('PLACE',r'\b(?:New\s+)?Delhi\b'),
 'Pune / Poona':('PLACE',r'\b(?:Poona|Pune)\b'),
 'New York / Columbia':('PLACE',r'\b(?:New York|Columbia University)\b'),
 'London':('PLACE',r'\bLondon\b'),
 'Vadodara / Baroda':('PLACE',r'\b(?:Baroda|Vadodara)\b'),
 'Yeola':('PLACE',r'\bYeola\b'),
}
coords={'Mahad':[18.083,73.417],'Mumbai / Bombay':[19.076,72.878],'Nagpur':[21.146,79.089],'Delhi':[28.614,77.209],'Pune / Poona':[18.521,73.856],'New York / Columbia':[40.807,-73.963],'London':[51.514,-0.116],'Vadodara / Baroda':[22.307,73.181],'Yeola':[20.042,74.489]}
compiled={name:(kind,re.compile(pattern,re.I)) for name,(kind,pattern) in terms.items()}
mentions=defaultdict(list);counts=defaultdict(int);edges=defaultdict(lambda:{'count':0,'sources':[]});pairs=defaultdict(lambda:{'count':0,'sources':[]})
for doc in docs:
 for page in json.load(gzip.open(root/f"{doc['id']}.bin"))['pages']:
  text=page['text']
  if not text:continue
  page_matches=[]
  for name,(kind,pattern) in compiled.items():
   matches=list(pattern.finditer(text))
   if not matches:continue
   m=matches[0];source=' '.join(text[max(0,m.start()-125):min(len(text),m.end()+190)].split())
   # A snippet is literal page text and never a generated quotation.
   ref={'documentId':doc['id'],'pageNumber':page['pageNumber'],'pageId':page['pageId'],'sourceText':source,'method':page['method']}
   mentions[name].append(ref);counts[name]+=len(matches)
   edge=edges[(doc['id'],name)];edge['count']+=len(matches)
   if len(edge['sources'])<5:edge['sources'].append(ref)
   page_matches.append(name)
  # A shared page is a co-mention, never an inferred historical relationship.
  for i,left in enumerate(page_matches):
   for right in page_matches[i+1:]:
    if left==right:continue
    pair=pairs[(left,right) if left<right else (right,left)]
    pair['count']+=1
    if len(pair['sources'])<4:pair['sources'].append({'documentId':doc['id'],'pageNumber':page['pageNumber'],'pageId':page['pageId'],'sourceText':' '.join(text[:300].split()),'method':page['method']})

nodes=[{'id':d['id'],'label':d['title'].split(' · supplied')[0],'type':'DOCUMENT','pageCount':d['pageCount'],'mentionCount':sum(v['count'] for (did,_),v in edges.items() if did==d['id']),'sources':[]} for d in docs]
nodes += [{'id':name,'label':name,'type':kind,'mentionCount':counts[name],'documentCount':sum(1 for d in docs if (d['id'],name) in edges),'sources':mentions[name][:30]} for name,(kind,_) in compiled.items() if mentions[name]]
links=[{'source':did,'target':name,'relation':'MENTIONS' if compiled[name][0] not in ('TOPIC','PLACE') else ('HAS_TOPIC' if compiled[name][0]=='TOPIC' else 'MENTIONS_PLACE'),'count':value['count'],'sources':value['sources']} for (did,name),value in edges.items()]
links += [{'source':left,'target':right,'relation':'CO_MENTIONED_ON_PAGE','count':value['count'],'sources':value['sources']} for (left,right),value in sorted(pairs.items(),key=lambda x:-x[1]['count'])[:120] if value['count']>=3]
def place_evidence(name):
 def quality(r):
  s=r['sourceText']
  return (3 if re.search(r'\bAmbedkar\b',s,re.I) else 0)+(2 if re.search(r'\b(?:addressed|visited|founded|led|held|met|delivered|established|participated|conference|satyagraha|conversion|speech)\b',s,re.I) else 0)+(1 if re.search(r'\b(?:18|19)\d{2}\b',s) else 0)+min(len(s),300)/300
 ranked=sorted(mentions[name],key=quality,reverse=True);result=[];per_doc=defaultdict(int)
 for r in ranked:
  if per_doc[r['documentId']]>=3:continue
  result.append(r);per_doc[r['documentId']]+=1
  if len(result)==24:break
 return result
places=[{'id':name,'label':name,'lat':coords[name][0],'lon':coords[name][1],'mentionCount':counts[name],'documentCount':sum(1 for d in docs if (d['id'],name) in edges),'sources':place_evidence(name)} for name in coords if mentions[name]]
highlights={
 'Mahad':('Chowdar Tank Satyagraha','VOL-10',23,r'Chowdar Tank Satyagraha in Mahad'),
 'London':('Round Table Conferences','VOL-10',24,r'Round Table Conferences in London'),
 'Nagpur':('Nagpur conversion ceremony','VOL-17-I',472,r'Nagpur ceremony'),
 'Yeola':('Conversion question at Yeola','VOL-05',405,r'Yeola in 1935'),
 'New York / Columbia':('Study at Columbia University','VOL-10',22,r'Columbia University of New York'),
}
for place in places:
 if place['id'] not in highlights:continue
 title,did,page,needle=highlights[place['id']]
 if did not in doc_ids:continue
 record=json.load(gzip.open(root/f'{did}.bin'))['pages'][page-1]
 match=re.search(needle.replace(' ',r'\s+'),record['text'],re.I)
 if not match:raise ValueError(f'Highlight evidence missing: {title} {did} {page}')
 excerpt=' '.join(record['text'][max(0,match.start()-150):min(len(record['text']),match.end()+280)].split())
 place['highlight']={'title':title,'source':{'documentId':did,'pageNumber':page,'pageId':record['pageId'],'sourceText':excerpt,'method':record['method']}}
with gzip.open(root/'explorer.bin','wt',encoding='utf8',compresslevel=7) as f:json.dump({'documents':len(docs),'pages':sum(d['pageCount'] for d in docs),'nodes':nodes,'links':links,'places':places},f,ensure_ascii=False,separators=(',',':'))
print(f'{len(nodes)} nodes; {len(links)} sourced links; {len(places)} source-mentioned places')
import subprocess,sys
subprocess.run([sys.executable,str(Path(__file__).with_name('build-gravity-index.py'))],check=True)
