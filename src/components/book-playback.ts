export type Turn = {from:number;to:number;direction:1|-1};

/** The reader owns playback; a canvas is only a view of this state. */
export class BookPlayback {
 index=0;
 turn:Turn|null=null;
 progress=0;
 target=0;
 dragging=false;
 dragTarget=0;
 private from=0;
 private started=0;
 private duration=900;
 private lastTick=0;
 private count:number;
 constructor(count:number){this.count=count}
 begin(direction:1|-1,dragging:boolean,now:number){
  const to=this.index+direction;
  if(this.turn||to<0||to>=this.count)return false;
  this.turn={from:this.index,to,direction};this.progress=0;this.dragTarget=0;this.target=dragging?0:1;this.dragging=dragging;
  this.from=0;this.started=now;this.lastTick=now;this.duration=980;return true;
 }
 drag(progress:number){if(this.turn&&this.dragging)this.dragTarget=Math.max(0,Math.min(1,progress))}
 release(commit:boolean,now:number){
  if(!this.turn)return;
  this.dragging=false;this.target=commit?1:0;this.from=this.progress;this.started=now;
  this.duration=180+650*Math.abs(this.target-this.from);
 }
 tick(now:number){
  if(!this.turn)return;
  if(this.dragging){const delta=Math.max(0,Math.min(.1,(now-this.lastTick)/1000));this.lastTick=now;this.progress+=(this.dragTarget-this.progress)*(1-Math.exp(-delta*28));return}
  const fraction=Math.max(0,Math.min(1,(now-this.started)/this.duration));
  const eased=fraction*fraction*fraction*(fraction*(fraction*6-15)+10);
  this.progress=this.from+(this.target-this.from)*eased;
  if(fraction===1){if(this.target===1)this.index=this.turn.to;this.turn=null}
 }
}
