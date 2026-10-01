#!/usr/bin/env python3
"""Page-backed source mention network and cautious event candidates."""
import gzip,json,re,subprocess,sys
from pathlib import Path
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[1]/'public/corpus';docs=json.loads((ROOT/'manifest.json').read_text());patterns={'Dr. B. R. Ambedkar':('PERSON',r'\b(?:Dr\.?\s*)?(?:B\.?\s*R\.?\s*|Babasaheb\s*)?Ambedkar\b'),'Constituent Assembly':('ORGANIZATION',r'\bConstituent Assembly\b'),'Mahatma Gandhi':('PERSON',r'\b(?:Mahatma\s+)?Gandhi\b'),'Jawaharlal Nehru':('PERSON',r'\b(?:Jawaharlal\s+)?Nehru\b'),'Education':('TOPIC',r'\beducation(?:al)?\b'),'Labour':('TOPIC',r'\blabou?r\b'),'Constitutional safeguards':('TOPIC',r'\bconstitutional safeguards?\b'),'Fundamental rights':('TOPIC',r'\bfundamental rights?\b'),'Social democracy':('TOPIC',r'\bsocial democracy\b'),'Caste':('TOPIC',r'\bcaste\b'),'Representation':('TOPIC',r'\brepresentation\b'),'Buddhism':('TOPIC',r'\bBuddhis(?:m|t)\b')};compiled={name:(kind,re.compile(pattern,re.I)) for name,(kind,pattern) in patterns.items()};pages=defaultdict(list);edges=[];events=[];event_signatures=set()
for doc in docs:
 for p in json.load(gzip.open(ROOT/f"{doc['id']}.bin"))['pages']:
  text=p['text']
  for name,(kind,pattern) in compiled.items():
   m=pattern.search(text)
   if m:
    evidence=' '.join(text[max(0,m.start()-80):m.end()+120].split());pages[name].append([doc['id'],p['pageNumber']]);edges.append({'from':doc['id'],'to':name,'type':'HAS_TOPIC' if kind=='TOPIC' else 'MENTIONED','pageId':p['pageId'],'sourceText':evidence,'confidence':1})
  for chunk in p['chunks']:
   for s in re.split(r'(?<=[.!?])\s+(?=[A-Z])',chunk['text']):
    if not 45<=len(s)<=560:continue
    year=re.search(r'\b(?:17|18|19)\d{2}\b',s)
    action=re.search(r'\b(?:held|passed|founded|formed|established|adopted|delivered|signed|convened|addressed|born|died|resigned|appointed|elected|converted|marched|met|proposed|launched|opened|declared|resolved|presented|submitted|celebrated|participated)\b',s,re.I)
    if year and action:
     signature=' '.join(s.casefold().split())
     key=(doc['id'],p['pageNumber'],signature)
     if key not in event_signatures:event_signatures.add(key);events.append({'date':year.group(),'datePrecision':'YEAR','sourceText':s,'documentId':doc['id'],'pageNumber':p['pageNumber'],'reviewStatus':'CANDIDATE'})
nodes=[{'label':name,'type':compiled[name][0],'pages':items,'documents':list(dict.fromkeys(d for d,_ in items))} for name,items in pages.items()]
with gzip.open(ROOT/'graph.bin','wt',encoding='utf8',compresslevel=7) as f:json.dump({'nodes':nodes,'edges':edges,'events':events},f,separators=(',',':'),ensure_ascii=False)
print(len(nodes),'nodes',len(edges),'source edges',len(events),'event candidates')
subprocess.run([sys.executable,str(Path(__file__).with_name('build_timeline.py'))],check=True)
