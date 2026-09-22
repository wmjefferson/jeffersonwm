import xml.etree.ElementTree as ET
import os

svg_path = r"E:\other\assets\batt-favicon.svg"
tree = ET.parse(svg_path)
root = tree.getroot()
paths = root.findall('.//{http://www.w3.org/2000/svg}path')
if not paths:
    paths = root.findall('.//path')

scale = 0.068
tx = 19.13
ty = 18.82

color_map = {
    'white': '#FFFFFFFF',
    '#055190': '#FF055190',
    '#1A4FA0': '#FF1A4FA0',
    '#C66D0D': '#FFC66D0D',
    '#E87722': '#FFE87722'
}

# 1. Generate ic_launcher_foreground.xml
fg_lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
    '    android:width="108dp"',
    '    android:height="108dp"',
    '    android:viewportWidth="108"',
    '    android:viewportHeight="108">',
    f'    <group',
    f'        android:scaleX="{scale}"',
    f'        android:scaleY="{scale}"',
    f'        android:translateX="{tx}"',
    f'        android:translateY="{ty}">'
]

for p in paths[1:]: # skip path 0 (background)
    fill = p.attrib.get('fill', '#055190')
    fill_color = color_map.get(fill, fill)
    if not fill_color.startswith('#'):
        fill_color = '#FFFFFFFF'
    elif len(fill_color) == 7:
        fill_color = '#FF' + fill_color[1:]
    d = p.attrib.get('d', '')
    fg_lines.append(f'        <path')
    fg_lines.append(f'            android:fillColor="{fill_color}"')
    fg_lines.append(f'            android:pathData="{d}" />')

fg_lines.append('    </group>')
fg_lines.append('</vector>')

fg_file = r"E:\battalion\android\app\src\main\res\drawable\ic_launcher_foreground.xml"
with open(fg_file, 'w', encoding='utf-8') as f:
    f.write('\n'.join(fg_lines) + '\n')
print(f"Wrote {fg_file}")

# 2. Generate ic_launcher_background.xml (clean white background matching favicon)
bg_lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
    '    android:width="108dp"',
    '    android:height="108dp"',
    '    android:viewportWidth="108"',
    '    android:viewportHeight="108">',
    '    <path',
    '        android:fillColor="#FFFFFFFF"',
    '        android:pathData="M0,0h108v108h-108z" />',
    '</vector>'
]
bg_file = r"E:\battalion\android\app\src\main\res\drawable\ic_launcher_background.xml"
with open(bg_file, 'w', encoding='utf-8') as f:
    f.write('\n'.join(bg_lines) + '\n')
print(f"Wrote {bg_file}")
