# Icon Requirements for GenLayer VS Code Extension

## Required Icon
- **Filename**: `icon.png`
- **Size**: 128x128 pixels
- **Format**: PNG with transparent background
- **Color depth**: 32-bit (RGBA)

## Optional Icons (for better quality)
- **Filename**: `icon-256.png`
- **Size**: 256x256 pixels
- **Purpose**: Marketplace display

## Design Guidelines
- Use transparent background
- Ensure visibility on both light and dark backgrounds
- Keep design simple and recognizable at small sizes
- File size should be under 100KB

## How to Add Icons
1. Create a 128x128px PNG image named `icon.png`
2. Place it in this `images` directory
3. Optionally, create a 256x256px version named `icon-256.png`
4. Run `npm run package` to rebuild the extension

## Icon Usage
- **Extension gallery**: 128x128px (scaled from provided icon)
- **VS Code marketplace**: 256x256px (if provided) or scaled 128x128px
- **Activity bar**: Automatically scaled to 32x32px
- **Extension view**: Automatically scaled as needed

The icon path is already configured in package.json as `"icon": "images/icon.png"`