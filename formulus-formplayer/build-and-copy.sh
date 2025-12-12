#!/bin/bash

# Build and copy Formplayer to Android assets (macOS/Linux compatible)

set -e

echo "🔄 Syncing FormulusInterfaceDefinition.ts..."
cp -f ../formulus/src/webview/FormulusInterfaceDefinition.ts ./src/FormulusInterfaceDefinition.ts

echo "🏗️  Building Formplayer React app..."
npm run build

echo "🧹 Cleaning old Android assets..."
rm -rf ../formulus/android/app/src/main/assets/formplayer_dist
mkdir -p ../formulus/android/app/src/main/assets/formplayer_dist

echo "📦 Copying build files to Android assets..."
cp -r ./build/* ../formulus/android/app/src/main/assets/formplayer_dist/

echo "✅ Done! Formplayer has been built and copied to Android assets."
echo "📱 Next step: Rebuild the Android app in Android Studio"

