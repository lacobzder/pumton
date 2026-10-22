// Lifts the crown off the banner (gold/gem colour key inside a hand-placed polygon) and fills
// the head under it: onion-peel average from the edge, smoothed, then fur grain borrowed from the forehead.
const sharp=require('sharp');
(async()=>{require('fs').mkdirSync('public/assets',{recursive:true});
const {data,info}=await sharp('source-assets/banner.png').removeAlpha().raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height;
const X0=860,Y0=95,CW=190,CH=100;
function hsv(r,g,b){const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360}return[h,mx?d/mx:0,mx/255]}
let m=new Uint8Array(CW*CH);const P=[[915,101],[1032,101],[1035,147],[1019,192],[1002,190],[925,175],[912,162]];function inPoly(x,y){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const[xi,yi]=P[i],[xj,yj]=P[j];if(((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c}return c}
for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){const i=((Y0+y)*W+X0+x)*3;const[h,s,v]=hsv(data[i],data[i+1],data[i+2]);
const gold=h>=38&&h<=60&&s>0.45&&v>0.45, red=(h<15||h>340)&&s>0.55&&v>0.35, blue=h>190&&h<250&&s>0.4;
// ignore the ear (left, low)
if((gold||red||blue)&&inPoly(X0+x,Y0+y))m[y*CW+x]=1;}
const morph=(src,r,dil)=>{const o=new Uint8Array(CW*CH);for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){let v=dil?0:1;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(dx*dx+dy*dy>r*r)continue;const xx=x+dx,yy=y+dy;const s=(xx<0||yy<0||xx>=CW||yy>=CH)?0:src[yy*CW+xx];if(dil&&s)v=1;if(!dil&&!s)v=0;}o[y*CW+x]=v;}return o};
m=morph(morph(m,4,true),4,false);
// fill holes
{const ext=new Uint8Array(CW*CH);const st=[];for(let x=0;x<CW;x++)st.push(x,(CH-1)*CW+x);for(let y=0;y<CH;y++)st.push(y*CW,y*CW+CW-1);while(st.length){const k=st.pop();if(ext[k]||m[k])continue;ext[k]=1;const x=k%CW,y=(k/CW)|0;if(x>0)st.push(k-1);if(x<CW-1)st.push(k+1);if(y>0)st.push(k-CW);if(y<CH-1)st.push(k+CW);}for(let k=0;k<CW*CH;k++)if(!ext[k])m[k]=1;}
// crown cutout with 1px feather
const soft=morph(m,1,false);
const cut=Buffer.alloc(CW*CH*4);
for(let k=0;k<CW*CH;k++){const x=k%CW,y=(k/CW)|0;const i=((Y0+y)*W+X0+x)*3;cut[k*4]=data[i];cut[k*4+1]=data[i+1];cut[k*4+2]=data[i+2];cut[k*4+3]=soft[k]?255:(m[k]?150:0);}
// bbox
let bx0=CW,by0=CH,bx1=0,by1=0;for(let k=0;k<CW*CH;k++)if(m[k]){const x=k%CW,y=(k/CW)|0;bx0=Math.min(bx0,x);by0=Math.min(by0,y);bx1=Math.max(bx1,x);by1=Math.max(by1,y);}
console.log('crown bbox banner', X0+bx0, Y0+by0, bx1-bx0+1, by1-by0+1);
await sharp(cut,{raw:{width:CW,height:CH,channels:4}}).extract({left:bx0,top:by0,width:bx1-bx0+1,height:by1-by0+1}).png().toFile('public/assets/crown.png');
// inpaint mask: dilate 2
const im=morph(m,6,true);
const img=Float32Array.from(data);
const idx=(x,y)=>(y*W+x)*3;
for(let k=0;k<CW*CH;k++)if(im[k]){const x=X0+k%CW,y=Y0+((k/CW)|0);const i=idx(x,y);img[i]=img[i+1]=img[i+2]=-1;}
// onion-peel fill from boundary inward, averaging known neighbours
let left=true;while(left){left=false;const upd=[];for(let k=0;k<CW*CH;k++){if(!im[k])continue;const x=X0+k%CW,y=Y0+((k/CW)|0);const i=idx(x,y);if(img[i]>=0)continue;let s=[0,0,0],n=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const j=idx(x+dx,y+dy);if(img[j]>=0){const w=1/(dx*dx+dy*dy);s[0]+=img[j]*w;s[1]+=img[j+1]*w;s[2]+=img[j+2]*w;n+=w}}if(n>0)upd.push([i,s.map(v=>v/n)]);else left=true;}for(const[i,c]of upd){img[i]=c[0];img[i+1]=c[1];img[i+2]=c[2];}if(!upd.length)break;}
// smoothing passes inside mask
for(let p=0;p<30;p++){for(let k=0;k<CW*CH;k++){if(!im[k])continue;const x=X0+k%CW,y=Y0+((k/CW)|0);const i=idx(x,y);for(let c=0;c<3;c++)img[i+c]=(img[idx(x+1,y)+c]+img[idx(x-1,y)+c]+img[idx(x,y+1)+c]+img[idx(x,y-1)+c])/4;}}
// fur grain: high-pass from the fur 45px below, faded in where the fill is orange
for(let k=0;k<CW*CH;k++){if(!im[k])continue;const x=X0+k%CW,y=Y0+((k/CW)|0);const i=idx(x,y);const sat=(img[i]-img[i+2])/255;if(sat<0.15)continue;const a=Math.min(1,(sat-0.15)*3);let off=0;for(const o of [22,30,38,46]){const yy=y+o-Y0,xx=x-X0;if(y+o<206&&(yy>=CH||!im[yy*CW+xx])){off=o;break}}if(!off)continue;const j=idx(x,y+off);let mean=[0,0,0];for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const q=idx(x+dx,y+off+dy);for(let c=0;c<3;c++)mean[c]+=data[q+c]/25;}for(let c=0;c<3;c++)img[i+c]+=(data[j+c]-mean[c])*a*0.9;}
const outb=Buffer.from(img.map(v=>Math.max(0,Math.min(255,Math.round(v)))));
require('fs').mkdirSync('public/assets',{recursive:true});await sharp(outb,{raw:{width:W,height:H,channels:3}}).jpeg({quality:88,mozjpeg:true}).toFile('public/assets/plate.jpg');
})();
