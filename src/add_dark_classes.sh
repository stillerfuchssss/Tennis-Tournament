#!/bin/bash

# Füge dark: Klassen für wichtige Bereiche hinzu
sed -i 's/className="bg-white rounded-xl border border-slate-200/className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/g' App.tsx
sed -i 's/className="bg-white rounded-lg border border-slate-200/className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700/g' App.tsx
sed -i 's/className="bg-slate-50 /className="bg-slate-50 dark:bg-slate-900 /g' App.tsx
sed -i 's/className="text-slate-800 /className="text-slate-800 dark:text-slate-100 /g' App.tsx
sed -i 's/className="text-slate-700 /className="text-slate-700 dark:text-slate-200 /g' App.tsx
sed -i 's/className="text-slate-600 /className="text-slate-600 dark:text-slate-300 /g' App.tsx

echo "Dark Mode Klassen hinzugefügt"
