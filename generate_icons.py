#!/usr/bin/env python3
"""
簡単なプレースホルダーアイコンを生成するスクリプト
"""
from PIL import Image, ImageDraw, ImageFont
import os

# アイコンサイズ
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

# テーマカラー
bg_color = (92, 107, 192)  # #5c6bc0
text_color = (255, 255, 255)  # white

# iconsディレクトリを確認
icons_dir = "icons"
if not os.path.exists(icons_dir):
    os.makedirs(icons_dir)

for size in sizes:
    # 新しい画像を作成
    img = Image.new('RGB', (size, size), bg_color)
    draw = ImageDraw.Draw(img)

    # 絵文字アイコン風の円を描画（シンプルなデザイン）
    margin = size // 8
    circle_bbox = [margin, margin, size - margin, size - margin]

    # 白い円を描画
    draw.ellipse(circle_bbox, fill=text_color)

    # 内側に小さい円を描画（計算機のイメージ）
    inner_margin = size // 4
    inner_circle_bbox = [inner_margin, inner_margin, size - inner_margin, size - inner_margin]
    draw.ellipse(inner_circle_bbox, fill=bg_color)

    # ファイルを保存
    filename = f"{icons_dir}/icon-{size}.png"
    img.save(filename, "PNG")
    print(f"✓ 生成完了: {filename}")

print("\nすべてのアイコンが生成されました！")
