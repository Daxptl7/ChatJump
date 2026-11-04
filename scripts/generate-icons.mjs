import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
const segments = [[24,26,104,26],[104,26,104,88],[104,88,44,88],[44,88,24,104],[24,104,24,26],[46,70,80,42],[60,42,80,42],[80,42,80,62]];
function near(x,y,[a,b,c,d]) {
  const t = Math.max(0,Math.min(1,((x-a)*(c-a)+(y-b)*(d-b))/((c-a)**2+(d-b)**2)));
  return (x-a-t*(c-a))**2+(y-b-t*(d-b))**2 <= 9;
}
function crc32(data) {
  let crc=0xFFFFFFFF;
  for(const byte of data) { crc^=byte; for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xEDB88320:0); }
  return (crc^0xFFFFFFFF)>>>0;
}
function chunk(type,data) {
  const tag=Buffer.from(type), length=Buffer.alloc(4), crc=Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([tag,data])));
  return Buffer.concat([length,tag,data,crc]);
}
mkdirSync(new URL('../public/icon/',import.meta.url),{recursive:true});
for(const size of [16,32,48,128]) {
  const raw=Buffer.alloc(size*(1+size*4));
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const white=segments.some(s=>near((x+0.5)*128/size,(y+0.5)*128/size,s));
    const offset=y*(1+size*4)+1+x*4;
    raw[offset]=raw[offset+1]=raw[offset+2]=white?255:23; raw[offset+3]=255;
  }
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4); ihdr[8]=8; ihdr[9]=6;
  writeFileSync(new URL(`../public/icon/${size}.png`,import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
