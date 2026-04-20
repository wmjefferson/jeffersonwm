import fs from 'fs';
import path from 'path';
import https from 'https';

const IMAGES_DIR = path.join(process.cwd(), 'images');

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const downloadImage = (url, filename) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302) {
        https.get(res.headers.location, (res2) => {
          const file = fs.createWriteStream(filename);
          res2.pipe(file);
          file.on('finish', () => {
            file.close(resolve);
          });
        }).on('error', reject);
      } else {
        const file = fs.createWriteStream(filename);
        res.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }
    }).on('error', reject);
  });
};

async function main() {
  for (let i = 1; i <= 10; i++) {
    const url = `https://picsum.photos/seed/lion${i}/800/800`;
    const filename = path.join(IMAGES_DIR, `lion${i}.jpg`);
    await downloadImage(url, filename);
    console.log(`Downloaded ${filename}`);
  }
}

main();
