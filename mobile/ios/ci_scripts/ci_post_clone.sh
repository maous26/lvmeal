#!/bin/zsh

# Xcode Cloud post-clone script
# Installs CocoaPods dependencies

set -e

echo "📦 Setting up environment..."

# Xcode Cloud uses macOS with Homebrew pre-installed
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "📦 Installing Node.js via Homebrew..."
brew install node || echo "Node already installed"

echo "📦 Installing CocoaPods via Homebrew..."
brew install cocoapods || echo "CocoaPods already installed"

echo "📦 Installing Node.js dependencies..."
cd "$CI_PRIMARY_REPOSITORY_PATH/mobile"
/opt/homebrew/bin/npm install || /usr/local/bin/npm install || npm install

echo "📦 Running pod install..."
cd "$CI_PRIMARY_REPOSITORY_PATH/mobile/ios"
/opt/homebrew/bin/pod install || /usr/local/bin/pod install || pod install

echo "✅ Dependencies installed successfully!"
