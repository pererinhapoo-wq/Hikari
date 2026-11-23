import fs from 'node:fs';
import path from 'node:path';

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else {
      results.push(full);
    }
  });
  return results;
}

const files = walk('public').concat(walk('src'));
const images = files.filter(f => /\.(png|svg|jpg|webp)$/i.test(f));

images.forEach(file => {
  const stat = fs.statSync(file);
  let dims = 'N/A';
  if (file.endsWith('.png')) {
    try {
      const buf = fs.readFileSync(file);
      if (buf.subarray(1, 4).toString() === 'PNG') {
        const w = buf.readUInt32BE(16);
        const h = buf.readUInt32BE(20);
        dims = w + 'x' + h;
      }
    } catch (e) {}
  }
  console.log(file + ' | size: ' + stat.size + ' | dims: ' + dims);
});
