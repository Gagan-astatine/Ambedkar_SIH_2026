#!/usr/bin/env python3
"""Page-addressable, source-faithful import of the eleven supplied PDFs."""
import gzip,hashlib,json,re,subprocess,sys
from pathlib import Path
import fitz,numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'public/corpus'; SRC=Path(sys.argv[1]); OUT.mkdir(parents=True,exist_ok=True);(OUT/'pdf').mkdir(exist_ok=True)
NAMES=['Volume2(1).pdf','Volume3(1).pdf','Volume4(1).pdf','Volume5(1).pdf','Volume6(1).pdf','Volume7.pdf','Volume8.pdf','Volume9.pdf','Volume10.pdf','Volume11.pdf','Volume12.pdf']
def ocr(page):
 try:
  pix=page.get_pixmap(matrix=fitz.Matrix(1.35,1.35),alpha=False)
  proc=subprocess.run(['tesseract','stdin','stdout','-l','eng','--psm','3','tsv'],input=pix.tobytes('png'),capture_output=True,check=True,timeout=75)
  rows=[r.split('\t') for r in proc.stdout.decode('utf8','replace').splitlines()[1:]];rows=[r for r in rows if len(r)>=12 and r[11].strip()]
  lines={};confs=[]
  for r in rows:
   lines.setdefault(tuple(r[2:6]),[]).append(r[11]);
   if float(r[10])>=0:confs.append(float(r[10])/100)
  return '\n'.join(' '.join(x) for x in lines.values()),(sum(confs)/len(confs) if confs else None)
 except Exception:return '',None
def chunk(text):
 parts=[re.sub(r'\s+',' ',s).strip() for s in re.split(r'\n\s*\n',text)];out=[];acc=''
 for p in parts:
  if len(p)<35:continue
  if acc and len(acc)+len(p)>850:out.append(acc);acc=''
  acc+=((' ' if acc else '')+p)
 if acc:out.append(acc)
 return [{'position':i,'text':v} for i,v in enumerate(out) if len(v)>45]
def heads(text):
 out=[]
 for raw in text.splitlines():
  s=' '.join(raw.split())
  if len(s)>170:continue
  m=re.match(r'^(part|chapter|section|appendix)\s+([ivxlcdm]+|\d+)\b',s,re.I)
  if m:out.append({'title':s,'level':m.group(1).upper(),'confidence':.92})
 return out[:5]
manifest=[];texts=[];locations=[]
for name in NAMES:
 p=SRC/name;num=int(re.search(r'Volume(\d+)',name).group(1));did=f'VOL-{num:02d}';original=OUT/'pdf'/name
 if not original.exists():
  with p.open('rb') as a,original.open('wb') as b:
   while block:=a.read(1024*1024):b.write(block)
 digest=hashlib.sha256(p.read_bytes()).hexdigest();pdf=fitz.open(p)
 doc={'id':did,'title':f'Volume {num} · supplied PDF','filename':name,'sha256':digest,'bytes':p.stat().st_size,'pageCount':len(pdf),'source':'User-supplied PDF','extraction':{'native':0,'ocr':0,'unreadable':0}}
 with gzip.open(OUT/f'{did}.bin','wt',encoding='utf8',compresslevel=6) as f:
  f.write('{"pages":[')
  for i,page in enumerate(pdf):
   text=page.get_text('text',sort=True).strip();method='NATIVE_TEXT';confidence=None
   if len(re.sub(r'\s+','',text))<90:text,confidence=ocr(page);method='OCR' if text.strip() else 'UNREADABLE'
   doc['extraction'][{'NATIVE_TEXT':'native','OCR':'ocr','UNREADABLE':'unreadable'}[method]]+=1;text=text.replace('\0','').strip();pid=f'{did}-P{i+1:04d}'
   rows=[x.strip() for x in text.splitlines() if x.strip()];printed=next((x for x in rows[:3]+rows[-3:] if re.fullmatch(r'(?:\d{1,4}|[ivxlcdm]{1,9})',x,re.I)),None)
   rec={'documentId':did,'pageId':pid,'pageNumber':i+1,'printedPage':printed,'text':text,'method':method,'confidence':confidence,'headings':heads(text),'chunks':chunk(text)}
   f.write((',' if i else '')+json.dumps(rec,ensure_ascii=False,separators=(',',':')))
   if len(text)>70:texts.append(text[:8000]);locations.append([did,i+1])
  f.write(']}')
 manifest.append(doc);(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2));print(did,len(pdf),doc['extraction'],flush=True)
v=TfidfVectorizer(max_features=6000,min_df=3,max_df=.85,stop_words='english',sublinear_tf=True,ngram_range=(1,2));x=v.fit_transform(texts);svd=TruncatedSVD(n_components=48,n_iter=5,random_state=17);pv=normalize(svd.fit_transform(x)).astype('float32');terms=v.get_feature_names_out()
m={'kind':'CORPUS_LSA_48','dimensions':48,'vocabulary':{t:i for i,t in enumerate(terms)},'idf':np.round(v.idf_,4).tolist(),'components':np.round(svd.components_.T,4).tolist(),'pageLocations':locations,'pageVectors':np.round(pv,4).tolist(),'explainedVariance':float(svd.explained_variance_ratio_.sum())}
with gzip.open(OUT/'semantic-model.bin','wt',encoding='utf8',compresslevel=8) as f:json.dump(m,f,separators=(',',':'))
print('INDEXED',len(locations),'SOURCE PAGES',flush=True)
subprocess.run([sys.executable,str(Path(__file__).with_name('build-explorer.py'))],check=True)
subprocess.run([sys.executable,str(Path(__file__).with_name('build-graph.py'))],check=True)
subprocess.run([sys.executable,str(Path(__file__).with_name('build_keyword_index.py'))],check=True)
