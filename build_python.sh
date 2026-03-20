#!/bin/bash
# Script to build standalone Python binary for Cycy

echo "🚀 Starting Python Build..."

# 1. Setup/check venv or current environment
echo "📦 Installing requirements..."
python3 -m pip install -r requirements.txt
python3 -m pip install pyinstaller

# 2. Build with PyInstaller
echo "🛠 Building binary with PyInstaller..."
python3 -m PyInstaller --onefile \
            --name cycy-ai \
            --clean \
            --distpath ./dist-python \
            main.py

echo "✅ Python Build Complete: ./dist-python/cycy-ai"
ls -lh ./dist-python/cycy-ai
