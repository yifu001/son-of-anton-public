---
created: 2026-01-20T15:12
title: Change app logo to new terminal icon
area: ui
files:
  - media/logo.png
  - media/icon.ico
  - media/icon.icns
---

## Problem

App logo needs to be updated to new sci-fi terminal prompt icon provided by user. The icon features:
- Black background
- Cyan/teal glowing hexagonal frame
- Terminal prompt symbol (>_) in center
- Circuit-like decorative elements
- Matches the eDEX-UI aesthetic

## Solution

1. Save provided image as source asset
2. Generate required formats:
   - logo.png (various sizes for Electron)
   - icon.ico (Windows)
   - icon.icns (macOS)
3. Replace existing logo files in media/ directory
4. Update any references in package.json or electron configs
