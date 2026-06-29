const fs = require('fs');
const path = require('path');
const ORDER = [
  'src/core/rng.js', 'src/core/game-state.js',
  'src/data/sprites.js', 'src/data/enemy-art.js', 'src/data/bg-art.js', 'src/data/ally-art.js', 'src/data/field-art.js', 'src/data/walk-art.js', 'src/data/characters.js', 'src/data/skills.js',
  'src/data/enemies.js', 'src/data/items.js', 'src/data/maps.js', 'src/data/story.js',
  'src/logic/progression.js', 'src/logic/items-effect.js', 'src/logic/battle.js',
  'src/logic/monster.js', 'src/logic/forge.js', 'src/logic/tournament.js', 'src/logic/ally-ai.js', 'src/logic/save.js',
  'src/engine/canvas.js', 'src/engine/render.js', 'src/engine/input.js',
  'src/engine/scene.js', 'src/engine/storage.js',
  'src/scenes/dialog.js', 'src/scenes/title-scene.js', 'src/scenes/field-scene.js',
  'src/scenes/battle-scene.js', 'src/scenes/menu-scene.js', 'src/scenes/shop-scene.js', 'src/scenes/forge-scene.js', 'src/scenes/tournament-scene.js',
  'src/main.js',
];
const js = ORDER.filter(f => fs.existsSync(f)).map(f => `// === ${f} ===\n` + fs.readFileSync(f, 'utf8')).join('\n');
// ホーム画面アイコン(apple-touch-icon)を data URI で埋め込む（あれば）
const iconPath = 'assets/app-icon-180.png';
const iconTag = fs.existsSync(iconPath)
  ? `<link rel="apple-touch-icon" href="data:image/png;base64,${fs.readFileSync(iconPath).toString('base64')}">\n`
  : '';
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="ユイトの冒険">
<meta name="theme-color" content="#0b0b12">
${iconTag}<title>ユイトと黄金のサッカーボール</title>
<style>html,body{margin:0;height:100%;background:#0b0b12;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}
#game{display:block;margin:0 auto;image-rendering:pixelated;background:#000}</style></head>
<body><canvas id="game"></canvas><script>\n${js}\n</script></body></html>`;
fs.writeFileSync('index.html', html);
console.log('built index.html', html.length, 'bytes');
