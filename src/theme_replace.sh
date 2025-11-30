#!/bin/bash

# Ersetze häufige Label-Klassen
sed -i 's/className="text-xs font-bold text-slate-600 uppercase/className={`text-xs font-bold ${currentTheme.labelText} uppercase`}/g' App.tsx
sed -i 's/className="text-xs font-bold text-slate-600 uppercase block mb-1"/className={`text-xs font-bold ${currentTheme.labelText} uppercase block mb-1`}/g' App.tsx
sed -i 's/className="block text-xs font-bold text-slate-600 uppercase mb-2"/className={`block text-xs font-bold ${currentTheme.labelText} uppercase mb-2`}/g' App.tsx
sed -i 's/className="text-xs font-bold text-slate-600 uppercase mb-2"/className={`text-xs font-bold ${currentTheme.labelText} uppercase mb-2`}/g' App.tsx

# Ersetze häufige Info-Text-Klassen
sed -i 's/className="text-sm text-slate-600"/className={`text-sm ${currentTheme.infoText}`}/g' App.tsx
sed -i 's/className="text-xs text-slate-500/className={`text-xs ${currentTheme.textMuted}/g' App.tsx

echo "Theme-Ersetzungen abgeschlossen"
