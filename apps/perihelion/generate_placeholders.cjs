const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'images', 'folder 2');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const dimensions = [
  [800, 600], [400, 800], [1024, 768], [500, 500],
  [1200, 400], [600, 900], [800, 800], [1920, 1080],
  [300, 600], [900, 600], [720, 720]
];

const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71', '#F1C40F'];

dimensions.forEach(([w, h], i) => {
  const color = colors[i % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${color}" />
    <text x="50%" y="50%" font-family="sans-serif" font-size="${Math.min(w, h) * 0.1}px" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">
      ${w} x ${h}
    </text>
  </svg>`;
  
  fs.writeFileSync(path.join(dir, `placeholder_${i + 1}.svg`), svg);
});
console.log('Generated 11 placeholders');
