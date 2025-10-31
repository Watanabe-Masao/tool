#!/usr/bin/env node
/**
 * 簡単なプレースホルダーアイコンを生成
 * PNG形式で最小限の有効なファイルを作成
 */
const fs = require('fs');
const path = require('path');

// アイコンサイズ
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// テーマカラー #5c6bc0 = rgb(92, 107, 192)
const r = 92, g = 107, b = 192;

function createPNG(width, height, r, g, b) {
  // 最小限の有効なPNGを作成
  const PNG = require('pngjs').PNG;
  const png = new PNG({ width, height });

  // 背景色を設定
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;

      // 中央に白い円を描画
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = width * 0.35;
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

      if (distance < radius) {
        // 白い円の内側
        const innerRadius = width * 0.23;
        if (distance < innerRadius) {
          // 内側の円はテーマカラー
          png.data[idx] = r;
          png.data[idx + 1] = g;
          png.data[idx + 2] = b;
          png.data[idx + 3] = 255;
        } else {
          // 中間は白
          png.data[idx] = 255;
          png.data[idx + 1] = 255;
          png.data[idx + 2] = 255;
          png.data[idx + 3] = 255;
        }
      } else {
        // 背景はテーマカラー
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = 255;
      }
    }
  }

  return PNG.sync.write(png);
}

// pngjs がインストールされているか確認
try {
  require.resolve('pngjs');

  const iconsDir = path.join(__dirname, 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir);
  }

  sizes.forEach(size => {
    const buffer = createPNG(size, size, r, g, b);
    const filename = path.join(iconsDir, `icon-${size}.png`);
    fs.writeFileSync(filename, buffer);
    console.log(`✓ 生成完了: icons/icon-${size}.png`);
  });

  console.log('\nすべてのアイコンが生成されました！');
} catch (err) {
  console.log('pngjs がインストールされていません。インストール中...');
  console.log('npm install pngjs を実行してください。');
}
