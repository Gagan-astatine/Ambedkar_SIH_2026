export const BOOK_PAGE_WIDTH=2.04;
export const BOOK_PAGE_HEIGHT=2.97;
export const BOOK_OPEN_ANGLE=.29;

/** Integrate paper tangents along the leaf, keeping the sheet's width constant. */
export function sampleBookPage(u:number,v:number,progress:number,side:1|-1):[number,number,number]{
 const p=Math.max(0,Math.min(1,progress));
 const base=-side*(BOOK_OPEN_ANGLE+(Math.PI-2*BOOK_OPEN_ANGLE)*p);
 const bend=-side*Math.sin(Math.PI*p)*.72*(1+.16*v);
 const steps=16,step=u/steps;let x=0,z=0;
 for(let i=0;i<steps;i++){
  const s=(i+.5)*step,profile=s*s*(3-2*s),angle=base+bend*profile;
  x+=side*Math.cos(angle)*step*BOOK_PAGE_WIDTH;
  z-=side*Math.sin(angle)*step*BOOK_PAGE_WIDTH;
 }
 const crown=.055*(1-u)*(1-u)+.012*u*u+.004*Math.cos(v*Math.PI/2);
 return [x,v*BOOK_PAGE_HEIGHT/2-Math.sin(Math.PI*p)*.018*u*u*v,.43+z+crown];
}
