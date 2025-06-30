# ✨ Purikura Photo Booth App

A kawaii-style photo booth application with AI-powered background removal, real-time filters, drawing tools, and sticker placement. Built with vanilla JavaScript and TensorFlow.js for a seamless cross-platform experience.

## 🌟 Features

- 📷 **Photo Capture/Upload** - Take photos or upload from device
- 🎨 **Real-time Filters** - Vintage, Dreamy, Kawaii, Neon, and Soft effects
- 🌈 **AI Background Change** - Smart person segmentation with gradient backgrounds
- 🚫 **Background Removal** - AI-powered background elimination
- ✏️ **Drawing Tools** - Multi-color brush with adjustable sizes
- ✨ **Interactive Stickers** - Drag-and-drop emoji stickers
- 📱 **Mobile Optimized** - Touch-friendly interface
- 💾 **Instant Download** - High-quality image export

## 🚀 Live Demo

[View Demo](https://photofun.netlify.app/)


## JS Functions:
1. Photo Management System
### Core photo handling
- handlePhotoSelect()    // Input processing
- setupCanvas()          // Canvas initialization
- originalPhotoData      // Backup storage
2. AI Background Processing
### TensorFlow.js + BodyPix integration
- loadSegmentationModel() // Model initialization
- changeBackground()      // AI-powered segmentation
- removeBackground()      // Person extraction
- createGradientCanvas()  // Background generation
3. Drawing Engine
### Canvas-based drawing system
- setupDrawing()         // Event listeners
- saveDrawingState()     // History management
- undoDrawing()/redoDrawing() // State restoration
4. Filter System
### CSS filter application
- applyFilter()          // Real-time filter effects
- Filter types: vintage, dreamy, kawaii, neon, soft
5. Sticker Management
### Dynamic sticker placement
- addSticker()           // Emoji placement
- Drag & drop functionality
- Double-tap removal
6. Final 
### Multi-layer rendering
- createFinalImage()     // Composite generation

