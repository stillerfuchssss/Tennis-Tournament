#!/bin/bash

# Ersetze häufige Section-Container
sed -i 's/className="bg-white rounded-xl shadow-sm border border-slate-200 p-6/className={`${currentTheme.sectionBg} rounded-xl shadow-sm border ${currentTheme.border} p-6`}/g' App.tsx
sed -i 's/className="bg-white rounded-lg shadow-sm border border-slate-200 p-4/className={`${currentTheme.sectionBg} rounded-lg shadow-sm border ${currentTheme.border} p-4`}/g' App.tsx

# Ersetze häufige Background-Container
sed -i 's/className="bg-slate-50 p-4 rounded-xl border border-slate-100/className={`${currentTheme.contentBg} p-4 rounded-xl border ${currentTheme.border}`}/g' App.tsx

echo "Zusätzliche Theme-Ersetzungen abgeschlossen"
