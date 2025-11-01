# App Logo and Splash Screen Specifications

## Design Overview

Based on the provided design, this document outlines the specifications for the app logo and splash screen assets.

## Color Palette

- **Primary Background**: `#2F1E78` (Deep Indigo/Purple)
- **Icon Container**: `#3B2990` (Slightly darker, more saturated purple)
- **Text & Graphics**: `#FFFFFF` (Pure White)

## App Icon Specifications

### Main Icon (`icon.png`)

- **Size**: 1024x1024 pixels (Expo standard)
- **Format**: PNG with transparency support
- **Design Elements**:
  - **Container**: Rounded square (modern app icon shape with significantly rounded corners)
    - Color: `#3B2990`
    - Neumorphic style with soft shadows and highlights
    - Light highlight on top-left edges
    - Dark shadow on bottom-right edges
  - **Graphic**: White grid pattern in upper half
    - Four rectangular shapes in 2x2 asymmetric grid
    - Top-left: Small white square
    - Top-right: Vertical rectangle (2x height)
    - Bottom-left: Horizontal rectangle (2x width)
    - Bottom-right: Small white square (same as top-left)
    - Consistent gaps between shapes
  - **Text**: "Do It" below the graphic
    - Font: Modern sans-serif, medium weight
    - Color: `#FFFFFF`
    - Case: "Do It" (capitalize first letter of each word)

### Android Adaptive Icon (`adaptive-icon.png`)

- **Size**: 1024x1024 pixels (foreground image)
- **Format**: PNG
- **Background Color**: `#2F1E78` (configured in app.json)
- **Design**: Same as main icon, but ensure important elements are centered in the safe zone
  - Safe zone: 66% center of the icon (to account for different Android icon shapes)

### Splash Screen Icon (`splash-icon.png`)

- **Recommended Size**: 1284x2778 pixels (or high resolution for better quality)
- **Format**: PNG
- **Background Color**: `#2F1E78` (configured in app.json)
- **Design Options**:
  1. **Full Icon**: The complete app icon centered on the background
  2. **Icon Only**: Just the icon container without background (for contain resize mode)
  3. **Minimal**: Icon with "Do It" text, centered on indigo background

### Favicon (`favicon.png`)

- **Size**: 48x48 pixels minimum (or higher for better quality)
- **Format**: PNG or ICO
- **Design**: Simplified version of the app icon (icon only, no text, or minimal design)

## Implementation Notes

1. **Neumorphic Effect**: The icon container should have a subtle 3D effect:

   - Soft, diffused shadows
   - Light highlight from top-left
   - Dark shadow on bottom-right
   - Creates a raised/sculptural appearance

2. **Export Settings**:

   - Use transparent background where appropriate
   - Export at high resolution (2x or 3x for retina displays)
   - Ensure anti-aliasing is enabled for smooth edges

3. **Testing**:
   - Test icons on both light and dark backgrounds
   - Verify appearance on different Android icon shapes
   - Check splash screen on various device sizes

## File Requirements

All images should be placed in the `assets/` folder:

- `icon.png` (1024x1024) - Main app icon
- `adaptive-icon.png` (1024x1024) - Android adaptive icon foreground
- `splash-icon.png` (1284x2778 or higher) - Splash screen image
- `favicon.png` (48x48 or higher) - Web favicon

## Configuration

The app.json has been configured with:

- Splash screen background color: `#2F1E78`
- Android adaptive icon background: `#2F1E78`

## Tools for Creation

You can create these assets using:

- **Design Tools**: Figma, Adobe Illustrator, Sketch, Canva
- **Online Generators**: App Icon Generator, Icon Kitchen (for Android adaptive icons)
- **AI Tools**: DALL-E, Midjourney (with detailed prompts)
- **Professional Services**: Fiverr, Upwork (for custom design)

## Next Steps

1. Create or source the image files based on these specifications
2. Place them in the `assets/` folder
3. Run `expo start` to preview
4. Use `expo prebuild` if you need to regenerate native code for splash screens
5. Test on actual devices to ensure proper display
