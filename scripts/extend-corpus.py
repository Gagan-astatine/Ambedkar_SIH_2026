#!/usr/bin/env python3
"""Append supplied PDFs without touching previously indexed originals; rebuild shared vectors."""
import gzip, hashlib, json, os, re, shutil, subprocess, sys
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import fitz
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize

root=Path(__file__).resolve().parents[1]/'public/corpus'
source=Path(sys.argv[1]); manifest=json.loads((root/'manifest.json').read_text())
names=['Volume1(2).pdf','Volume13.pdf','Volume14_Part_I.pdf','Volume14_Part_II.pdf','Volume15.pdf','Volume16.pdf','Volume17_Part_I.pdf','Volume17_Part_II.pdf','Volume17_Part_III.pdf']
ids=['VOL-01','VOL-13','VOL-14-I','VOL-14-II','VOL-15','VOL-16','VOL-17-I','VOL-17-II','VOL-17-III']

def ocr(png):
 try:
  proc=subprocess.run(['tesseract','stdin','stdout','-l','eng','--psm','3'],input=png,capture_output=True,check=True,timeout=90,env={**os.environ,'OMP_THREAD_LIMIT':'1'})
  return proc.stdout.decode('utf8','replace'),None
 except Exception:return '',None

def chunks(text):
 parts=[re.sub(r'\s+',' ',s).strip() for s in re.split(r'\n\s*\n',text)]
 out=[];acc=''
 for p in parts:
  if len(p)<35:continue
  if acc and len(acc)+len(p)>850:out.append(acc);acc=''
  acc+=(' ' if acc else '')+p
 if acc:out.append(acc)
 return [{'position':i,'text':v} for i,v in enumerate(out) if len(v)>45]

for name,did in zip(names,ids):
 if any(d['id']==did for d in manifest):continue
 path=source/name; dest=root/'pdf'/name
 shutil.copyfile(path,dest)
 pdf=fitz.open(path);digest=hashlib.file_digest(path.open('rb'),'sha256').hexdigest()
 number=re.search(r'Volume(\d+)',name).group(1)
 part=re.search(r'Part_(I+|II|III)',name)
 title=f'Volume {number}'+(f' · Part {part.group(1)}' if part else '')+' · supplied PDF'
 doc={'id':did,'title':title,'filename':name,'sha256':digest,'bytes':path.stat().st_size,'pageCount':len(pdf),'source':'User-supplied PDF','extraction':{'native':0,'ocr':0,'unreadable':0}}
 with gzip.open(root/f'{did}.bin','wt',encoding='utf8',compresslevel=6) as f, ThreadPoolExecutor(max_workers=6) as pool:
  f.write('{"pages":[')
  queue=deque()
  def write(item):
   i,text,future=item;confidence=None;method='NATIVE_TEXT'
   if future is not None:text,confidence=future.result();method='OCR' if text.strip() else 'UNREADABLE'
   doc['extraction'][{'NATIVE_TEXT':'native','OCR':'ocr','UNREADABLE':'unreadable'}[method]]+=1
   text=text.replace('\0','').strip();rows=[x.strip() for x in text.splitlines() if x.strip()]
   printed=next((x for x in rows[:3]+rows[-3:] if re.fullmatch(r'(?:\d{1,4}|[ivxlcdm]{1,9})',x,re.I)),None)
   headings=[]
   for raw in rows:
    s=' '.join(raw.split())
    if len(s)<170:
     m=re.match(r'^(part|chapter|section|appendix)\s+([ivxlcdm]+|\d+)\b',s,re.I)
     if m:headings.append({'title':s,'level':m.group(1).upper(),'confidence':.92})
   rec={'documentId':did,'pageId':f'{did}-P{i+1:04d}','pageNumber':i+1,'printedPage':printed,'text':text,'method':method,'confidence':confidence,'headings':headings[:5],'chunks':chunks(text)}
   f.write((',' if i else '')+json.dumps(rec,ensure_ascii=False,separators=(',',':')))
  for i,page in enumerate(pdf):
   text=page.get_text('text',sort=True).strip()
   future=None
   if len(re.sub(r'\s+','',text))<90:
    pix=page.get_pixmap(matrix=fitz.Matrix(1.15,1.15),alpha=False)
    future=pool.submit(ocr,pix.tobytes('png'))
   queue.append((i,text,future))
   if len(queue)>=12:write(queue.popleft())
   if i and i%100==0:print(did,'processed',i,'/',len(pdf),flush=True)
  while queue:write(queue.popleft())
  f.write(']}')
 manifest.append(doc);(root/'manifest.json').write_text(json.dumps(manifest,indent=2))
 print(did,len(pdf),doc['extraction'],flush=True)

manifest.sort(key=lambda d:(int(d['id'][4:6]),{'I':0,'II':1,'III':2}.get(d['id'].split('-')[-1],0)))
(root/'manifest.json').write_text(json.dumps(manifest,indent=2))
texts=[];locations=[]
for doc in manifest:
 for page in json.load(gzip.open(root/f"{doc['id']}.bin"))['pages']:
  if len(page['text'])>70:texts.append(page['text'][:8000]);locations.append([doc['id'],page['pageNumber']])
v=TfidfVectorizer(max_features=6000,min_df=3,max_df=.85,stop_words='english',sublinear_tf=True,ngram_range=(1,2))
x=v.fit_transform(texts);svd=TruncatedSVD(n_components=48,n_iter=5,random_state=17)
vectors=normalize(svd.fit_transform(x)).astype('float32')
m={'kind':'CORPUS_LSA_48','dimensions':48,'vocabulary':{t:i for i,t in enumerate(v.get_feature_names_out())},'idf':np.round(v.idf_,4).tolist(),'components':np.round(svd.components_.T,4).tolist(),'pageLocations':locations,'pageVectors':np.round(vectors,4).tolist(),'explainedVariance':float(svd.explained_variance_ratio_.sum())}
with gzip.open(root/'semantic-model.bin','wt',encoding='utf8',compresslevel=8) as f:json.dump(m,f,separators=(',',':'))
print('INDEXED',len(locations),'SOURCE PAGES',flush=True)
subprocess.run([sys.executable,str(Path(__file__).with_name('build-explorer.py'))],check=True)
subprocess.run([sys.executable,str(Path(__file__).with_name('build-graph.py'))],check=True)
subprocess.run([sys.executable,str(Path(__file__).with_name('build_keyword_index.py'))],check=True)
