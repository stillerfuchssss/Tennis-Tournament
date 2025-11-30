#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os

files = [
    r'c:\Users\Dennis\tennis-manager\tennis-manager2\src\App.tsx',
    r'c:\Users\Dennis\tennis-manager\tennis-manager2\src\src\App.tsx'
]

replacements = {
    'Ã¤': 'ä',
    'Ã¶': 'ö',
    'Ã¼': 'ü',
    'Ã„': 'Ä',
    'Ã–': 'Ö',
    'Ãœ': 'Ü',
    'Ã ': 'à',
    'Ã¡': 'á',
    'Ã©': 'é',
    'ÃŸ': 'ß',
    'Ã': 'ß',
    'â€¢': '•',
}

for filepath in files:
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            for old, new in replacements.items():
                content = content.replace(old, new)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f'✓ {filepath} repariert')
        except Exception as e:
            print(f'✗ Fehler bei {filepath}: {e}')
    else:
        print(f'✗ {filepath} nicht gefunden')
