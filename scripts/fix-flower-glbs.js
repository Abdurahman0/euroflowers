// GLB'larni qayta yozish: KHR_materials_transmission olib tashlanadi.
// Natija — Blender'da Transmission=0 bilan eksport qilingan fayl bilan bir xil.
const fs = require('fs');
function patch(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`not a GLB: ${file}`);
  const jsonLen = b.readUInt32LE(12);
  const j = JSON.parse(b.slice(20, 20 + jsonLen).toString());
  let touched = 0;
  for (const m of j.materials || []) {
    if (m.extensions?.KHR_materials_transmission) {
      delete m.extensions.KHR_materials_transmission;
      touched++;
      if (!Object.keys(m.extensions).length) delete m.extensions;
    }
  }
  if (!touched) { console.log(`  clean: ${file}`); return; }
  if (j.extensionsUsed) {
    j.extensionsUsed = j.extensionsUsed.filter((e) => e !== 'KHR_materials_transmission');
    if (!j.extensionsUsed.length) delete j.extensionsUsed;
  }
  let js = Buffer.from(JSON.stringify(j));
  const pad = (4 - (js.length % 4)) % 4;
  if (pad) js = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
  const rest = b.slice(20 + jsonLen); // BIN chunk(lar) o'zgarishsiz
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  const chunkHdr = Buffer.alloc(8);
  chunkHdr.writeUInt32LE(js.length, 0);
  chunkHdr.writeUInt32LE(0x4e4f534a, 4);
  const out = Buffer.concat([header, chunkHdr, js, rest]);
  out.writeUInt32LE(out.length, 8);
  fs.writeFileSync(file, out);
  console.log(`  fixed ${touched} materials: ${file}`);
}
process.argv.slice(2).forEach(patch);

// Ishlatish: node scripts/fix-flower-glbs.js public/flowers/**/*.glb
// Yoki:      find public/flowers -name "*.glb" -print0 | xargs -0 node scripts/fix-flower-glbs.js
//
// Nima uchun: Blender Principled BSDF'da Transmission > 0 bilan eksport
// qilingan GLB'lar three.js'da shaffof canvas + muhit xaritasisiz QORA
// ko'rinadi (transmission orqa buferni namuna oladi — u bo'sh/qora).
// Bu skript KHR_materials_transmission'ni olib tashlaydi; sheen/specular/ior
// saqlanadi (EnvironmentController IBL bergani uchun to'g'ri ishlaydi).
