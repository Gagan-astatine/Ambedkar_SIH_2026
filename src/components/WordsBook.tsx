'use client';
import {Canvas} from '@react-three/fiber';
import ReadingBookScene,{type BookMotion} from './ReadingBookScene';
import {Component,useEffect,useRef,useState,type ReactNode,type PointerEvent} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,X} from 'lucide-react';
import type {Language} from '@/src/config/i18n';
import './words-book.css';
import {BookPlayback,type Turn} from './book-playback';

type Quote={year:string;quote:string;source:string;documentId:string;page:number;what:string;where:string;when:string;why:string;note?:string};
const entries:Quote[]=[
 {year:'1924',quote:'Educate, Agitate and Organize',source:'Bahishkrit Hitkarini Sabha · Writings and Speeches, Vol. 17, Part II',documentId:'VOL-17-II',page:420,what:'The recorded vow of the Bahishkrit Hitkarini Sabha. The source attributes this wording to the institution, rather than identifying it as a verbatim Ambedkar speech.',where:'Bahishkrit Hitkarini Sabha constitution and editorial account',when:'The Sabha was established on 20 July 1924.',why:'The Sabha organized education and representation for excluded communities.',note:'Institutional motto as printed in the indexed edition.'},
 {year:'1936',quote:'Caste System is not merely division of labour. It is also a division of labourers.',source:'Annihilation of Caste · Writings and Speeches, Vol. 1',documentId:'VOL-01',page:62,what:'Ambedkar rejects the argument that caste is an ordinary division of labour.',where:'Annihilation of Caste, section IV',when:'1936',why:'The passage distinguishes occupational division from the graded and hereditary separation of workers.'},
 {year:'1938',quote:'I want all people to be Indian first, Indian last and nothing else but Indians',source:'On Creation of a Separate Karnatak Province · Writings and Speeches, Vol. 2',documentId:'VOL-02',page:214,what:'Ambedkar argues for a shared Indian civic identity.',where:'Bombay Legislative Assembly debate on a separate Karnatak province',when:'1938',why:'He cautions that competing cultural, religious and linguistic loyalties could weaken a common political goal.',note:'The shorter “We are Indians, firstly and lastly” rendering is not the wording printed on this indexed page.'},
 {year:'1942',quote:'I measure the progress of a community by the degree of progress which women have achieved',source:'Progress of Women · Writings and Speeches, Vol. 17, Part III',documentId:'VOL-17-III',page:311,what:'Ambedkar describes women’s advancement as a measure of community progress.',where:'All-India Depressed Classes Women’s Conference, Nagpur',when:'20 July 1942',why:'He addresses the women’s gathering and discusses organization, education and social reform.',note:'Excerpt from a longer sentence in the indexed speech.'},
 {year:'1949',quote:'Political democracy cannot last unless there lies at the base of it social democracy.',source:'Constituent Assembly speech · Writings and Speeches, Vol. 13',documentId:'VOL-13',page:1249,what:'Ambedkar says political institutions depend on social equality.',where:'Constituent Assembly',when:'25 November 1949',why:'The speech connects social democracy with liberty, equality and fraternity.'},
];
const labels={English:{title:'Words That Endure',kicker:'THE READING ROOM',intro:'Words, ideas and moments preserved in their historical context.',original:'ORIGINAL QUOTATION',context:'CONTEXT',source:'SOURCE',previous:'PREVIOUS',next:'NEXT',open:'OPEN SOURCE',what:'WHAT WAS HAPPENING',where:'WHERE',when:'WHEN',why:'HISTORICAL CONTEXT',close:'Close context',excerpt:'Source excerpt',unavailable:'The indexed page is available; its original PDF is not bundled in this edition.'},'हिन्दी':{title:'अमर शब्द',kicker:'पठन कक्ष',intro:'शब्द, विचार और क्षण अपने ऐतिहासिक संदर्भ में सुरक्षित।',original:'मूल उद्धरण',context:'संदर्भ',source:'स्रोत',previous:'पिछला',next:'अगला',open:'स्रोत खोलें',what:'क्या हो रहा था',where:'कहाँ',when:'कब',why:'ऐतिहासिक संदर्भ',close:'संदर्भ बंद करें',excerpt:'स्रोत अंश',unavailable:'अनुक्रमित पृष्ठ उपलब्ध है; मूल PDF इस संस्करण में शामिल नहीं है।'},'ಕನ್ನಡ':{title:'ಚಿರಸ್ಥಾಯಿ ಮಾತುಗಳು',kicker:'ಓದು ಕೋಣೆ',intro:'ಪದಗಳು, ವಿಚಾರಗಳು ಮತ್ತು ಕ್ಷಣಗಳು ಅವುಗಳ ಐತಿಹಾಸಿಕ ಸಂದರ್ಭದಲ್ಲಿ ಸಂರಕ್ಷಿತವಾಗಿವೆ.',original:'ಮೂಲ ಉಲ್ಲೇಖ',context:'ಸಂದರ್ಭ',source:'ಮೂಲ',previous:'ಹಿಂದೆ',next:'ಮುಂದೆ',open:'ಮೂಲ ತೆರೆಯಿರಿ',what:'ಏನಾಗುತ್ತಿತ್ತು',where:'ಎಲ್ಲಿ',when:'ಯಾವಾಗ',why:'ಐತಿಹಾಸಿಕ ಸಂದರ್ಭ',close:'ಸಂದರ್ಭ ಮುಚ್ಚಿ',excerpt:'ಮೂಲದ ಉಲ್ಲೇಖ',unavailable:'ಸೂಚ್ಯಂಕಿತ ಪುಟ ಲಭ್ಯವಿದೆ; ಮೂಲ PDF ಈ ಆವೃತ್ತಿಯಲ್ಲಿ ಸೇರಿಲ್ಲ.'}} as const;
const contextTranslations:Record<'हिन्दी'|'ಕನ್ನಡ',Array<{what:string;where:string;when:string;why:string;note?:string}>>={
 'हिन्दी':[
  {what:'बहिष्कृत हितकारिणी सभा का दर्ज किया गया ध्येय वाक्य; स्रोत इसे किसी भाषण का शब्दशः उद्धरण नहीं बताता।',where:'सभा के संविधान और संपादकीय विवरण में।',when:'सभा की स्थापना 20 जुलाई 1924 को हुई।',why:'सभा ने शिक्षा और वंचित समुदायों की प्रतिनिधित्व की माँग को संगठित किया।',note:'अनुक्रमित संस्करण में छपा संस्थागत ध्येय वाक्य।'},
  {what:'आंबेडकर जाति को केवल काम के बँटवारे के समान मानने वाले तर्क का विरोध करते हैं।',where:'एनिहिलेशन ऑफ कास्ट, खंड IV।',when:'1936',why:'इस अंश में काम के विभाजन और श्रमिकों के क्रमबद्ध, वंशानुगत विभाजन के बीच अंतर बताया गया है।'},
  {what:'आंबेडकर साझा भारतीय नागरिक पहचान की बात करते हैं।',where:'अलग कर्नाटक प्रांत पर बॉम्बे विधान सभा की बहस।',when:'1938',why:'उनकी चिंता थी कि धर्म, संस्कृति और भाषा के प्रति प्रतिस्पर्धी निष्ठाएँ साझा राजनीतिक उद्देश्य को कमजोर कर सकती हैं।',note:'इस पृष्ठ पर प्रचलित छोटे रूप के बजाय लंबा मूल वाक्य छपा है।'},
  {what:'आंबेडकर महिलाओं की प्रगति को समुदाय की प्रगति का पैमाना बताते हैं।',where:'अखिल भारतीय दलित वर्ग महिला सम्मेलन, नागपुर।',when:'20 जुलाई 1942',why:'उन्होंने सभा में संगठन, शिक्षा और सामाजिक सुधार की चर्चा की।',note:'यह अनुक्रमित भाषण के एक लंबे वाक्य का अंश है।'},
  {what:'आंबेडकर कहते हैं कि राजनीतिक संस्थाओं को सामाजिक समानता का आधार चाहिए।',where:'संविधान सभा।',when:'25 नवंबर 1949',why:'भाषण सामाजिक लोकतंत्र को स्वतंत्रता, समानता और बंधुत्व से जोड़ता है।'},
 ],
 'ಕನ್ನಡ':[
  {what:'ಬಹಿಷ್ಕೃತ ಹಿತಕಾರಿಣಿ ಸಭೆಯ ದಾಖಲಾದ ಧ್ಯೇಯವಾಕ್ಯ. ಮೂಲವು ಇದನ್ನು ಅಂಬೇಡ್ಕರ್ ಅವರ ಭಾಷಣದ ಪದಶಃ ಉಲ್ಲೇಖವೆಂದು ಹೇಳುವುದಿಲ್ಲ.',where:'ಸಭೆಯ ಸಂವಿಧಾನ ಮತ್ತು ಸಂಪಾದಕೀಯ ವಿವರಣೆಯಲ್ಲಿ.',when:'20 ಜುಲೈ 1924ರಂದು ಸಭೆ ಸ್ಥಾಪನೆಯಾಯಿತು.',why:'ಶಿಕ್ಷಣ ಮತ್ತು ಹೊರಗುಳಿದ ಸಮುದಾಯಗಳ ಪ್ರತಿನಿಧಿತ್ವಕ್ಕಾಗಿ ಸಭೆ ಸಂಘಟಿತವಾಯಿತು.',note:'ಸೂಚ್ಯಂಕಿತ ಆವೃತ್ತಿಯಲ್ಲಿ ಮುದ್ರಿತ ಸಂಸ್ಥೆಯ ಧ್ಯೇಯವಾಕ್ಯ.'},
  {what:'ಜಾತಿ ಸಾಮಾನ್ಯ ಕೆಲಸದ ವಿಭಾಗ ಮಾತ್ರ ಎಂಬ ವಾದವನ್ನು ಅಂಬೇಡ್ಕರ್ ತಿರಸ್ಕರಿಸುತ್ತಾರೆ.',where:'ಅನಿಹಿಲೇಷನ್ ಆಫ್ ಕಾಸ್ಟ್, ವಿಭಾಗ IV.',when:'1936',why:'ಈ ಭಾಗವು ಕೆಲಸದ ವಿಭಾಗ ಮತ್ತು ಕೆಲಸಗಾರರ ಶ್ರೇಣೀಕೃತ, ವಂಶಪಾರಂಪರ್ಯ ಬೇರ್ಪಡಿಕೆಯನ್ನು ವಿಭೇದಿಸುತ್ತದೆ.'},
  {what:'ಅಂಬೇಡ್ಕರ್ ಹಂಚಿಕೊಂಡ ಭಾರತೀಯ ನಾಗರಿಕ ಗುರುತನ್ನು ಒತ್ತಿಹೇಳುತ್ತಾರೆ.',where:'ಪ್ರತ್ಯೇಕ ಕರ್ನಾಟಕ ಪ್ರಾಂತ್ಯದ ಕುರಿತ ಬಾಂಬೆ ವಿಧಾನಸಭೆಯ ಚರ್ಚೆ.',when:'1938',why:'ಧರ್ಮ, ಸಂಸ್ಕೃತಿ ಮತ್ತು ಭಾಷೆಯ ಸ್ಪರ್ಧಾತ್ಮಕ ನಿಷ್ಠೆಗಳು ಸಾಮಾನ್ಯ ರಾಜಕೀಯ ಗುರಿಯನ್ನು ದುರ್ಬಲಗೊಳಿಸಬಹುದು ಎಂಬುದು ಅವರ ಕಳವಳ.',note:'ಈ ಪುಟದಲ್ಲಿ ಪ್ರಸಿದ್ಧ ಸಂಕ್ಷಿಪ್ತ ರೂಪಕ್ಕಿಂತ ಉದ್ದವಾದ ಮೂಲ ವಾಕ್ಯ ಇದೆ.'},
  {what:'ಮಹಿಳೆಯರ ಪ್ರಗತಿಯನ್ನು ಸಮುದಾಯದ ಪ್ರಗತಿಯ ಅಳತೆಯಾಗಿ ಅಂಬೇಡ್ಕರ್ ವಿವರಿಸುತ್ತಾರೆ.',where:'ಅಖಿಲ ಭಾರತ ದಲಿತ ವರ್ಗಗಳ ಮಹಿಳಾ ಸಮ್ಮೇಳನ, ನಾಗಪುರ.',when:'20 ಜುಲೈ 1942',why:'ಅವರು ಸಂಘಟನೆ, ಶಿಕ್ಷಣ ಮತ್ತು ಸಾಮಾಜಿಕ ಸುಧಾರಣೆಯ ಕುರಿತು ಮಾತನಾಡಿದರು.',note:'ಸೂಚ್ಯಂಕಿತ ಭಾಷಣದ ಉದ್ದವಾದ ವಾಕ್ಯದ ಒಂದು ಭಾಗ.'},
  {what:'ರಾಜಕೀಯ ಸಂಸ್ಥೆಗಳಿಗೆ ಸಾಮಾಜಿಕ ಸಮಾನತೆಯ ಅಡಿಪಾಯ ಬೇಕೆಂದು ಅಂಬೇಡ್ಕರ್ ಹೇಳುತ್ತಾರೆ.',where:'ಸಂವಿಧಾನ ಸಭೆ.',when:'25 ನವೆಂಬರ್ 1949',why:'ಭಾಷಣವು ಸಾಮಾಜಿಕ ಪ್ರಜಾಪ್ರಭುತ್ವವನ್ನು ಸ್ವಾತಂತ್ರ್ಯ, ಸಮಾನತೆ ಮತ್ತು ಸಹೋದರತ್ವದೊಂದಿಗೆ ಜೋಡಿಸುತ್ತದೆ.'},
 ]
};

function PageWords({entry,verso=false}:{entry:Quote;verso?:boolean}){
 return <><span className="words-fallback-kicker">{verso?'THE READING ROOM':'ORIGINAL QUOTATION'}</span>{verso?<strong>{entry.year}</strong>:<><span className="words-page-year">{entry.year}</span><blockquote lang="en">“{entry.quote}”</blockquote></>}<span className="words-fallback-rule"/><small>{entry.source.split(' · ')[0]}</small><i>PDF p. {entry.page}</i></>;
}
class BookSceneBoundary extends Component<{children:ReactNode;fallback:ReactNode;onUnavailable:()=>void},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true}}componentDidCatch(){this.props.onUnavailable()}render(){return this.state.failed?this.props.fallback:this.props.children}}
function FallbackBook({entry,turn,motion,pointer,visible,reduced,compact}:{entry:Quote;turn:Turn|null;motion:React.MutableRefObject<BookMotion>;pointer:React.MutableRefObject<{x:number;y:number}>;visible:boolean;reduced:boolean;compact:boolean}){
 const book=useRef<HTMLDivElement>(null),leaf=useRef<HTMLDivElement>(null),shadow=useRef<HTMLDivElement>(null),strips=useRef<Array<HTMLDivElement|null>>([]),pose=useRef({x:0,y:0});
 const displayed=turn?entries[turn.to]:entry,facing=turn?entries[turn.from]:entry;
 useEffect(()=>{
  if(!visible)return;let frame=0,last=performance.now(),tiltX=pose.current.x,tiltY=pose.current.y,width=leaf.current?.offsetWidth||0;
  const measure=()=>{width=leaf.current?.offsetWidth||0};const observer=new ResizeObserver(measure);if(book.current)observer.observe(book.current);
  const tick=(now:number)=>{
   const delta=Math.min(.1,(now-last)/1000);last=now;const damping=1-Math.exp(-delta*5);
   tiltX+=((reduced?0:-pointer.current.y*1.2)-tiltX)*damping;tiltY+=((reduced?0:pointer.current.x*1.6)-tiltY)*damping;
   pose.current={x:tiltX,y:tiltY};
   book.current?.style.setProperty('--tilt-x',`${tiltX}deg`);book.current?.style.setProperty('--tilt-y',`${tiltY}deg`);
   book.current?.style.setProperty('--book-lift',`${reduced?0:Math.sin(now*.00055)*.7}px`);
   if(turn&&leaf.current&&width){
    const p=motion.current.progress,curve=Math.sin(Math.PI*p),direction=turn.direction;
    const base=compact?0:-direction*9,rotation=base-direction*(compact?180:162)*p;
    leaf.current.style.transform=`translateZ(14px) rotateY(${rotation}deg)`;
    for(let i=0;i<12;i++){
     const strip=strips.current[i];if(!strip)continue;
     const u=direction===1?i/12:1-i/12,mid=direction===1?(i+.5)/12:1-(i+.5)/12;
     const bend=-direction*curve*.72;let x=0,z=0;
     for(let j=0;j<16;j++){const t=(j+.5)*u/16,angle=bend*t*t*(3-2*t);x+=Math.cos(angle)*u/16*width;z-=direction*Math.sin(angle)*u/16*width}
     const angle=bend*mid*mid*(3-2*mid);
     strip.style.transform=`translate3d(${direction===1?x:width-x}px,0,${z}px) rotateY(${angle*180/Math.PI}deg)`;
     const text=strip.firstElementChild as HTMLElement;text.style.width=`${width}px`;text.style.left=`${-i*width/12}px`;
    }
    if(shadow.current){shadow.current.style.opacity=String(curve*.23);shadow.current.style.transform=`translateX(${direction*curve*25}px) scaleX(${1-curve*.45})`}
   }
   if(!reduced||turn)frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);observer.disconnect()};
 },[visible,reduced,turn,compact,motion,pointer]);
 return <div className="words-fallback-display" aria-hidden="true"><div className="words-fallback-book" ref={book}>
  <div className="words-fallback-cover words-fallback-cover-left"/><div className="words-fallback-cover words-fallback-cover-right"/><div className="words-fallback-spine"/>
  <div className="words-fallback-block words-fallback-block-left"/><div className="words-fallback-block words-fallback-block-right"/>
  <div className="words-fallback-page words-fallback-page-left"><PageWords entry={displayed} verso/></div>
  <div className="words-fallback-page words-fallback-page-right"><PageWords entry={displayed}/></div>
  {turn&&<><div className={`words-turn-shadow ${turn.direction===-1?'reverse':''}`} ref={shadow}/><div className={`words-fallback-turn ${turn.direction===-1?'reverse':''}`} ref={leaf}>
   {Array.from({length:12},(_,i)=><div className="words-fallback-leaf-strip" key={i} ref={element=>{strips.current[i]=element}}><div className="words-fallback-leaf-content"><PageWords entry={facing} verso={turn.direction===-1&&!compact}/></div></div>)}
  </div></>}
 </div></div>;
}
export default function WordsBook({language,reduced,webgl,onOpen}:{language:Language;reduced:boolean;webgl:boolean;onOpen:(id:string,page:number)=>void}){
 const [index,setIndex]=useState(0),[turn,setTurn]=useState<Turn|null>(null),[context,setContext]=useState(false),[visible,setVisible]=useState(false),[compact,setCompact]=useState(false),[sceneFailed,setSceneFailed]=useState(false);
 const use3d=webgl&&!sceneFailed;
 const root=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null),playback=useRef(new BookPlayback(entries.length));
 const start=useRef<{id:number;x:number;y:number;direction:1|-1;dragging:boolean;lastX:number;lastAt:number;velocity:number}|null>(null),pointer=useRef({x:0,y:0}),motion=useRef<BookMotion>(playback.current),t=labels[language];
 useEffect(()=>{const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{rootMargin:'250px'});if(root.current)observer.observe(root.current);return()=>observer.disconnect()},[]);
 useEffect(()=>{const query=window.matchMedia('(max-width: 760px)');const update=()=>setCompact(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[]);
 useEffect(()=>{if(!context)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setContext(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[context]);
 function move(direction:1|-1,dragging=false){if(!playback.current.begin(direction,dragging,performance.now()))return false;setContext(false);setTurn(playback.current.turn);return true}
 useEffect(()=>{if(!turn)return;let frame=0;const tick=(now:number)=>{const controller=playback.current;controller.tick(now);if(!controller.turn){setIndex(controller.index);setTurn(null);start.current=null;return}frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[turn,use3d]);
 function down(event:PointerEvent<HTMLDivElement>){if(event.button!==0||playback.current.turn||(event.target as HTMLElement).closest('button'))return;
  const box=event.currentTarget.getBoundingClientRect(),relative=(event.clientX-box.left)/box.width;
  start.current={id:event.pointerId,x:event.clientX,y:event.clientY,direction:relative>=.5?1:-1,dragging:false,lastX:event.clientX,lastAt:performance.now(),velocity:0};
  event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus({preventScroll:true});
 }
 function drag(event:PointerEvent<HTMLDivElement>){const box=event.currentTarget.getBoundingClientRect();pointer.current={x:(event.clientX-box.left)/box.width*2-1,y:(event.clientY-box.top)/box.height*2-1};const gesture=start.current;if(!gesture||gesture.id!==event.pointerId)return;
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y,now=performance.now();
  gesture.velocity=(event.clientX-gesture.lastX)/Math.max(1,now-gesture.lastAt);gesture.lastX=event.clientX;gesture.lastAt=now;
  if(!gesture.dragging&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.2){gesture.direction=dx<0?1:-1;gesture.dragging=move(gesture.direction,true)}
  if(gesture.dragging){event.preventDefault();playback.current.drag((gesture.direction===1?-dx:dx)/(box.width*(compact?.5:.32)))}
 }
 function release(event:PointerEvent<HTMLDivElement>,cancel=false){const gesture=start.current;if(!gesture||gesture.id!==event.pointerId)return;start.current=null;
  if(gesture.dragging){const now=performance.now(),flick=now-gesture.lastAt<120&&gesture.velocity* -gesture.direction>.55&&playback.current.dragTarget>.06;playback.current.release(!cancel&&(playback.current.dragTarget>=.22||flick),now)}
  else if(!cancel&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<12)move(gesture.direction);
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 }
 const quote=entries[index],localized=language==='English'?null:contextTranslations[language][index];
 return <div className="words-room" ref={root}><div className="words-heading"><span>05 &nbsp; {t.kicker}</span><h2>{t.title}</h2><p>{t.intro}</p></div><div className="words-book-stage" ref={stage} tabIndex={0} aria-label="Interactive archival book. Tap a page or swipe to turn. Use left and right arrow keys." onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();move(event.key==='ArrowRight'?1:-1)}}} onPointerDown={down} onPointerMove={drag} onPointerUp={event=>release(event)} onPointerCancel={event=>release(event,true)} onLostPointerCapture={event=>release(event,true)} onPointerLeave={()=>{if(!start.current)pointer.current={x:0,y:0}}}>
 {use3d?<BookSceneBoundary onUnavailable={()=>setSceneFailed(true)} fallback={<FallbackBook entry={quote} turn={turn} motion={motion} pointer={pointer} visible={visible} reduced={reduced} compact={compact}/>}><Canvas key={compact?'compact':'wide'} shadows dpr={compact?[1,1.35]:[1,1.65]} frameloop={visible?'always':'never'} camera={{position:compact?[1.2,3.9,4.25]:[.5,4.2,5.2],fov:compact?32:36,near:.1,far:35}} fallback={<div className="words-canvas-fallback"><BookOpen size={60}/></div>}><ReadingBookScene entry={quote} previous={entries[Math.max(0,index-1)]} next={entries[Math.min(entries.length-1,index+1)]} turn={turn?{from:entries[turn.from],to:entries[turn.to],direction:turn.direction}:null} motion={motion} pointer={pointer} reduced={reduced} compact={compact} context={context}/></Canvas></BookSceneBoundary>:<FallbackBook entry={quote} turn={turn} motion={motion} pointer={pointer} visible={visible} reduced={reduced} compact={compact}/>}
 </div><div className="words-book-foot"><span>{String(index+1).padStart(2,'0')} / {String(entries.length).padStart(2,'0')}</span><div><button type="button" onClick={()=>move(-1)} disabled={index===0||!!turn}><ArrowLeft size={16}/>{t.previous}</button><button type="button" aria-expanded={context} onClick={()=>setContext(v=>!v)}>{t.context}</button><button type="button" onClick={()=>move(1)} disabled={index===entries.length-1||!!turn}>{t.next}<ArrowRight size={16}/></button></div></div>
 <div className="words-reading" key={index} aria-live="polite"><small>{t.original} · {quote.year}</small><blockquote lang="en">“{quote.quote}”</blockquote><p>{t.source}: {quote.source} · PDF p. {quote.page}</p>{quote.note&&<p className="words-note">{localized?.note||quote.note}</p>}<div className="words-actions"><button type="button" onClick={()=>onOpen(quote.documentId,quote.page)}>{t.open}<ArrowRight size={14}/></button></div>
 {context&&<aside className="words-context" aria-label={t.context}><button type="button" className="words-close" onClick={()=>setContext(false)} aria-label={t.close}><X size={19}/></button><small>{quote.year} / {t.context}</small><h3>{quote.source.split(' · ')[0]}</h3><dl><dt>{t.what}</dt><dd>{localized?.what||quote.what}</dd><dt>{t.where}</dt><dd>{localized?.where||quote.where}</dd><dt>{t.when}</dt><dd>{localized?.when||quote.when}</dd><dt>{t.why}</dt><dd>{localized?.why||quote.why}</dd><dt>{t.source}</dt><dd>{quote.source} · PDF p. {quote.page}</dd></dl><button type="button" className="words-open" onClick={()=>{setContext(false);onOpen(quote.documentId,quote.page)}}>{t.open}<ArrowRight size={15}/></button></aside>}
 </div></div>
}
