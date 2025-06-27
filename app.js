let currentPhoto = null;
let canvas, ctx;
let isDrawing = false;
let currentColor = '#ff6b9d';
let currentBrushSize = 5;
let placedStickers = [];
let currentBackground = null;
let currentFilter = 'none';
let drawingHistory = [];
let historyIndex = -1;
let segmentationModel = null;
let originalPhotoData = null;

// Initialize
window.onload = function() {
    canvas = document.getElementById('drawingCanvas');
    ctx = canvas.getContext('2d');
    setupCanvas();
    setupDrawing();
    saveDrawingState();
    loadSegmentationModel();
};

// Load TensorFlow.js BodyPix model for background segmentation
async function loadSegmentationModel() {
    try {
        console.log('Loading BodyPix model...');
        // Load BodyPix model - this works without CORS issues
        segmentationModel = await bodyPix.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            multiplier: 0.75,
            quantBytes: 2
        });
        console.log('BodyPix model loaded successfully');
    } catch (error) {
        console.log('Error loading BodyPix model:', error);
        console.log('Falling back to simple background replacement');
        segmentationModel = null;
    }
}

function setupCanvas() {
    const container = document.getElementById('photoContainer');
    const img = document.getElementById('mainPhoto');
    
    // If there's a photo loaded, use its dimensions
    if (img && img.naturalWidth && img.naturalHeight) {
        const containerRect = container.getBoundingClientRect();
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        
        // Calculate dimensions that fit the container while maintaining aspect ratio
        let canvasWidth = containerRect.width;
        let canvasHeight = containerRect.width / aspectRatio;
        
        if (canvasHeight > containerRect.height) {
            canvasHeight = containerRect.height;
            canvasWidth = containerRect.height * aspectRatio;
        }
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
    } else {
        // Fallback to container size if no image
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function setupDrawing() {
    let lastX, lastY;

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('touchstart', handleTouch);
    canvas.addEventListener('touchmove', handleTouch);
    canvas.addEventListener('touchend', stopDrawing);

    function startDrawing(e) {
        isDrawing = true;
        [lastX, lastY] = getCoordinates(e);
    }

    function draw(e) {
        if (!isDrawing) return;
        const [currentX, currentY] = getCoordinates(e);
        
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentBrushSize;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();
        
        [lastX, lastY] = [currentX, currentY];
    }

    function stopDrawing() {
        if (isDrawing) {
            isDrawing = false;
            saveDrawingState();
        }
    }

    function handleTouch(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent(
            e.type === 'touchstart' ? 'mousedown' : 
            e.type === 'touchmove' ? 'mousemove' : 'mouseup', 
            {
                clientX: touch.clientX,
                clientY: touch.clientY
            }
        );
        canvas.dispatchEvent(mouseEvent);
    }

    function getCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        return [
            (e.clientX - rect.left) * (canvas.width / rect.width),
            (e.clientY - rect.top) * (canvas.height / rect.height)
        ];
    }
}

function saveDrawingState() {
    historyIndex++;
    if (historyIndex < drawingHistory.length) {
        drawingHistory.length = historyIndex;
    }
    drawingHistory.push(canvas.toDataURL());
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    document.getElementById('undoBtn').disabled = historyIndex <= 0;
    document.getElementById('redoBtn').disabled = historyIndex >= drawingHistory.length - 1;
}

function undoDrawing() {
    if (historyIndex > 0) {
        historyIndex--;
        restoreDrawingState();
    }
}

function redoDrawing() {
    if (historyIndex < drawingHistory.length - 1) {
        historyIndex++;
        restoreDrawingState();
    }
}

function restoreDrawingState() {
    const img = new Image();
    img.onload = function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
    img.src = drawingHistory[historyIndex];
    updateUndoRedoButtons();
}

function takePhoto() {
    document.getElementById('cameraInput').click();
}

function uploadPhoto() {
    document.getElementById('photoInput').click();
}

document.getElementById('photoInput').addEventListener('change', handlePhotoSelect);
document.getElementById('cameraInput').addEventListener('change', handlePhotoSelect);

function handlePhotoSelect(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = document.getElementById('mainPhoto');
            img.src = event.target.result;
            img.style.display = 'block';
            document.getElementById('placeholder').style.display = 'none';
            currentPhoto = event.target.result;
            originalPhotoData = event.target.result;
            
            // Wait for image to load, then setup canvas with correct dimensions
            img.onload = function() {
                setupCanvas(); // Recalculate canvas size based on loaded image
                saveDrawingState(); // Save initial state with new canvas size
            };
            
            // Move to editing step
            setTimeout(() => {
                document.getElementById('step1').classList.remove('active');
                document.getElementById('step2').classList.add('active');
                document.getElementById('editingStep').classList.remove('hidden');
                // Apply default filter and select first filter option
                const firstFilterOption = document.querySelector('.filter-option');
                if (firstFilterOption) {
                    applyFilter('none', firstFilterOption);
                }
            }, 500);
        };
        reader.readAsDataURL(file);
    }
}

function applyFilter(filterType, targetElement = null) {
    const img = document.getElementById('mainPhoto');
    currentFilter = filterType;
    
    // Update filter selection
    document.querySelectorAll('.filter-option').forEach(opt => opt.classList.remove('selected'));
    if (targetElement) {
        targetElement.classList.add('selected');
    } else if (event && event.target) {
        event.target.classList.add('selected');
    }
    
    const filters = {
        none: 'none',
        vintage: 'sepia(80%) saturate(120%) contrast(110%)',
        dreamy: 'blur(1px) brightness(110%) saturate(120%) contrast(90%)',
        kawaii: 'saturate(150%) brightness(110%) contrast(120%) hue-rotate(10deg)',
        neon: 'saturate(200%) brightness(120%) contrast(150%) hue-rotate(90deg)',
        soft: 'brightness(110%) saturate(80%) contrast(85%) blur(0.5px)'
    };
    
    img.style.filter = filters[filterType];
}

async function changeBackground(bgType) {
    const img = document.getElementById('mainPhoto');
    const processingIndicator = document.getElementById('bgProcessing');
    
    // Show processing indicator
    processingIndicator.classList.remove('hidden');
    processingIndicator.textContent = 'Processing background...';
    
    try {
        if (!segmentationModel) {
            // Fallback to simple overlay method
            changeBackgroundSimple(bgType);
            return;
        }

        // Create image element for BodyPix processing - always use original photo
        const imageElement = new Image();
        imageElement.crossOrigin = 'anonymous';
        
        imageElement.onload = async function() {
            try {
                // Perform person segmentation using BodyPix
                const segmentation = await segmentationModel.segmentPerson(imageElement, {
                    flipHorizontal: false,
                    internalResolution: 'medium',
                    segmentationThreshold: 0.7,
                    maxDetections: 1,
                    scoreThreshold: 0.2,
                    nmsRadius: 20,
                });

                // Create background gradient
                const backgroundCanvas = createGradientCanvas(imageElement.naturalWidth, imageElement.naturalHeight, bgType);
                
                // Create final composite canvas
                const outputCanvas = document.createElement('canvas');
                const outputCtx = outputCanvas.getContext('2d');
                outputCanvas.width = imageElement.naturalWidth;
                outputCanvas.height = imageElement.naturalHeight;
                
                // Draw background first
                outputCtx.drawImage(backgroundCanvas, 0, 0);
                
                // Apply person segmentation mask
                const imageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
                
                // Create temporary canvas for original image
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = imageElement.naturalWidth;
                tempCanvas.height = imageElement.naturalHeight;
                tempCtx.drawImage(imageElement, 0, 0);
                const originalImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                
                // Apply mask: keep person pixels, use background for non-person pixels
                for (let i = 0; i < segmentation.data.length; i++) {
                    const isPerson = segmentation.data[i];
                    const pixelIndex = i * 4;
                    
                    if (isPerson) {
                        // Keep original person pixels
                        imageData.data[pixelIndex] = originalImageData.data[pixelIndex];         // R
                        imageData.data[pixelIndex + 1] = originalImageData.data[pixelIndex + 1]; // G
                        imageData.data[pixelIndex + 2] = originalImageData.data[pixelIndex + 2]; // B
                        imageData.data[pixelIndex + 3] = originalImageData.data[pixelIndex + 3]; // A
                    }
                    // Background pixels are already set from the gradient background
                }
                
                // Apply the processed image data
                outputCtx.putImageData(imageData, 0, 0);
                
                // Update the main photo with the result (but keep originalPhotoData intact)
                const processedDataUrl = outputCanvas.toDataURL('image/png');
                img.src = processedDataUrl;
                currentPhoto = processedDataUrl;
                currentBackground = bgType;
                
                // Update selection UI
                document.querySelectorAll('.bg-option').forEach(opt => opt.classList.remove('selected'));
                if (event && event.target) {
                    event.target.classList.add('selected');
                }
                
                console.log('Background replacement completed successfully');
                
            } catch (error) {
                console.error('BodyPix segmentation error:', error);
                // Fallback to simple method
                changeBackgroundSimple(bgType);
            } finally {
                processingIndicator.classList.add('hidden');
            }
        };

        imageElement.onerror = function() {
            console.error('Failed to load image for processing');
            changeBackgroundSimple(bgType);
            processingIndicator.classList.add('hidden');
        };
        
        // Always load the original image for processing
        imageElement.src = originalPhotoData;
        
    } catch (error) {
        console.error('Background processing error:', error);
        changeBackgroundSimple(bgType);
        processingIndicator.classList.add('hidden');
    }
}

function createGradientCanvas(width, height, bgType) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    
    const gradientColors = {
        gradient1: ['#ff9a9e', '#fecfef'],
        gradient2: ['#a8e6cf', '#dcedc1'],
        gradient3: ['#ffd3a5', '#fd9853'],
        gradient4: ['#a8caba', '#5d4e75'],
        gradient5: ['#89f7fe', '#66a6ff'],
        gradient6: ['#fdbb2d', '#22c1c3']
    };
    
    const colors = gradientColors[bgType] || ['#ff9a9e', '#fecfef'];
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    return canvas;
}

function changeBackgroundSimple(bgType) {
    const container = document.getElementById('photoContainer');
    const backgrounds = {
        gradient1: 'linear-gradient(45deg, #ff9a9e, #fecfef)',
        gradient2: 'linear-gradient(45deg, #a8e6cf, #dcedc1)',
        gradient3: 'linear-gradient(45deg, #ffd3a5, #fd9853)',
        gradient4: 'linear-gradient(45deg, #a8caba, #5d4e75)',
        gradient5: 'linear-gradient(45deg, #89f7fe, #66a6ff)',
        gradient6: 'linear-gradient(45deg, #fdbb2d, #22c1c3)'
    };
    
    // Apply background to the container
    container.style.background = backgrounds[bgType];
    currentBackground = backgrounds[bgType];
    
    // Make the photo slightly transparent so background shows through
    const img = document.getElementById('mainPhoto');
    if (img.style.display !== 'none') {
        img.style.mixBlendMode = 'multiply';
        img.style.opacity = '0.85';
    }
    
    // Update selection
    document.querySelectorAll('.bg-option').forEach(opt => opt.classList.remove('selected'));
    if (event && event.target) {
        event.target.classList.add('selected');
    }
    
    document.getElementById('bgProcessing').classList.add('hidden');
}

async function removeBackground() {
    const container = document.getElementById('photoContainer');
    const img = document.getElementById('mainPhoto');
    const processingIndicator = document.getElementById('bgProcessing');
    
    if (!segmentationModel || !originalPhotoData) {
        // Fallback: just reset to original
        if (originalPhotoData) {
            img.src = originalPhotoData;
            currentPhoto = originalPhotoData;
        }
        container.style.background = '#f0f0f0';
        img.style.mixBlendMode = 'normal';
        img.style.opacity = '1';
        currentBackground = null;
        document.querySelectorAll('.bg-option').forEach(opt => opt.classList.remove('selected'));
        return;
    }

    // Show processing indicator
    processingIndicator.classList.remove('hidden');
    processingIndicator.textContent = 'Removing background...';
    
    try {
        // Create image element for BodyPix processing - always use original photo
        const imageElement = new Image();
        imageElement.crossOrigin = 'anonymous';
        
        imageElement.onload = async function() {
            try {
                // Perform person segmentation using BodyPix
                const segmentation = await segmentationModel.segmentPerson(imageElement, {
                    flipHorizontal: false,
                    internalResolution: 'medium',
                    segmentationThreshold: 0.7,
                    maxDetections: 1,
                    scoreThreshold: 0.2,
                    nmsRadius: 20,
                });

                // Create output canvas for the cutout
                const outputCanvas = document.createElement('canvas');
                const outputCtx = outputCanvas.getContext('2d');
                outputCanvas.width = imageElement.naturalWidth;
                outputCanvas.height = imageElement.naturalHeight;
                
                // Fill with white background first
                outputCtx.fillStyle = 'white';
                outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
                
                // Create temporary canvas for original image
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = imageElement.naturalWidth;
                tempCanvas.height = imageElement.naturalHeight;
                tempCtx.drawImage(imageElement, 0, 0);
                const originalImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                
                // Get the background canvas data
                const backgroundImageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
                
                // Apply mask: keep person pixels, use white background for non-person pixels
                for (let i = 0; i < segmentation.data.length; i++) {
                    const isPerson = segmentation.data[i];
                    const pixelIndex = i * 4;
                    
                    if (isPerson) {
                        // Keep original person pixels
                        backgroundImageData.data[pixelIndex] = originalImageData.data[pixelIndex];         // R
                        backgroundImageData.data[pixelIndex + 1] = originalImageData.data[pixelIndex + 1]; // G
                        backgroundImageData.data[pixelIndex + 2] = originalImageData.data[pixelIndex + 2]; // B
                        backgroundImageData.data[pixelIndex + 3] = originalImageData.data[pixelIndex + 3]; // A
                    }
                    // Non-person pixels remain white (already set)
                }
                
                // Apply the processed image data
                outputCtx.putImageData(backgroundImageData, 0, 0);
                
                // Update the main photo with the background-removed result (but keep originalPhotoData intact)
                const processedDataUrl = outputCanvas.toDataURL('image/png');
                img.src = processedDataUrl;
                currentPhoto = processedDataUrl;
                
                // Reset container and UI
                container.style.background = '#f0f0f0';
                img.style.mixBlendMode = 'normal';
                img.style.opacity = '1';
                currentBackground = 'removed'; // Special flag to indicate background was removed
                
                // Clear background selection
                document.querySelectorAll('.bg-option').forEach(opt => opt.classList.remove('selected'));
                
                console.log('Background removal completed successfully');
                
            } catch (error) {
                console.error('Background removal error:', error);
                // Fallback to simple reset
                if (originalPhotoData) {
                    img.src = originalPhotoData;
                    currentPhoto = originalPhotoData;
                }
                container.style.background = '#f0f0f0';
                img.style.mixBlendMode = 'normal';
                img.style.opacity = '1';
                currentBackground = null;
                document.querySelectorAll('.bg-option').forEach(opt => opt.classList.remove('selected'));
            } finally {
                processingIndicator.classList.add('hidden');
            }
        };

        imageElement.onerror = function() {
            console.error('Failed to load image for background removal');
            processingIndicator.classList.add('hidden');
        };
        
        // Always load the original image for processing
        imageElement.src = originalPhotoData;
        
    } catch (error) {
        console.error('Background removal setup error:', error);
        processingIndicator.classList.add('hidden');
    }
}

function resetBackground() {
    const container = document.getElementById('photoContainer');
    const img = document.getElementById('mainPhoto');
    
    // Reset to original photo with original background
    if (originalPhotoData) {
        img.src = originalPhotoData;
        currentPhoto = originalPhotoData;
    }
    
    // Reset container background
    container.style.background = '#f0f0f0';
    
    // Reset photo blend mode and opacity
    img.style.mixBlendMode = 'normal';
    img.style.opacity = '1';
    
    currentBackground = null;
    document.querySelectorAll('.bg-option').forEach(opt => opt.classList.remove('selected'));
    
    console.log('Background reset to original');
}

function setDrawColor(color) {
    currentColor = color;
    // Update color picker selection
    document.querySelectorAll('.color-picker').forEach(picker => {
        const pickerColor = picker.style.backgroundColor;
        const isSelected = pickerColor === color || 
                          picker.style.background === color ||
                          picker.style.background.includes(color.replace('#', ''));
        picker.style.border = isSelected ? '3px solid #333' : '3px solid white';
    });
}

function setBrushSize(size) {
    currentBrushSize = size;
}

function clearDrawing() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveDrawingState();
}

function addSticker(emoji) {
    const container = document.getElementById('photoContainer');
    const sticker = document.createElement('div');
    sticker.className = 'placed-sticker';
    sticker.textContent = emoji;
    sticker.style.left = Math.random() * 70 + 15 + '%';
    sticker.style.top = Math.random() * 70 + 15 + '%';
    
    // Make sticker draggable
    let isDragging = false;
    let currentSticker = sticker;
    
    sticker.addEventListener('mousedown', startDrag);
    sticker.addEventListener('touchstart', startDrag);
    
    // Double tap to remove sticker
    let tapCount = 0;
    sticker.addEventListener('click', function() {
        tapCount++;
        setTimeout(() => {
            if (tapCount === 2) {
                sticker.remove();
                placedStickers = placedStickers.filter(s => s !== sticker);
            }
            tapCount = 0;
        }, 300);
    });
    
    function startDrag(e) {
        isDragging = true;
        currentSticker = sticker;
        e.preventDefault();
        e.stopPropagation();
    }
    
    const dragHandler = function(e) {
        if (!isDragging || currentSticker !== sticker) return;
        e.preventDefault();
        
        const touch = e.touches ? e.touches[0] : e;
        const rect = container.getBoundingClientRect();
        const x = ((touch.clientX - rect.left) / rect.width) * 100;
        const y = ((touch.clientY - rect.top) / rect.height) * 100;
        
        sticker.style.left = Math.max(0, Math.min(90, x)) + '%';
        sticker.style.top = Math.max(0, Math.min(90, y)) + '%';
    };
    
    const stopDragHandler = function() {
        if (currentSticker === sticker) {
            isDragging = false;
            currentSticker = null;
        }
    };
    
    document.addEventListener('mousemove', dragHandler);
    document.addEventListener('touchmove', dragHandler);
    document.addEventListener('mouseup', stopDragHandler);
    document.addEventListener('touchend', stopDragHandler);
    
    container.appendChild(sticker);
    placedStickers.push(sticker);
}

function finishEditing() {
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step3').classList.add('active');
    document.getElementById('finalStep').classList.remove('hidden');
    
    // Create final composite image
    createFinalImage();
}

function createFinalImage() {
    const finalCanvas = document.getElementById('finalCanvas');
    const finalCtx = finalCanvas.getContext('2d');
    const img = document.getElementById('mainPhoto');
    const container = document.getElementById('photoContainer');
    
    // Get the current computed styles and dimensions
    const containerRect = container.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    
    // Set final canvas to maintain aspect ratio
    const imgNaturalWidth = img.naturalWidth || img.width;
    const imgNaturalHeight = img.naturalHeight || img.height;
    const aspectRatio = imgNaturalWidth / imgNaturalHeight;
    
    // Calculate dimensions that fit the container while maintaining aspect ratio
    let canvasWidth = containerRect.width;
    let canvasHeight = containerRect.width / aspectRatio;
    
    if (canvasHeight > containerRect.height) {
        canvasHeight = containerRect.height;
        canvasWidth = containerRect.height * aspectRatio;
    }
    
    finalCanvas.width = canvasWidth;
    finalCanvas.height = canvasHeight;
    
    // Clear canvas
    finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
    
    // Draw background if set (for simple background mode)
    if (currentBackground && typeof currentBackground === 'string' && currentBackground.includes('linear-gradient')) {
        // Create a temporary canvas to generate the gradient background
        const tempBgCanvas = document.createElement('canvas');
        const tempBgCtx = tempBgCanvas.getContext('2d');
        tempBgCanvas.width = finalCanvas.width;
        tempBgCanvas.height = finalCanvas.height;
        
        // Parse and recreate the gradient
        let gradient;
        if (currentBackground.includes('#ff9a9e')) {
            gradient = tempBgCtx.createLinearGradient(0, 0, tempBgCanvas.width, tempBgCanvas.height);
            gradient.addColorStop(0, '#ff9a9e');
            gradient.addColorStop(1, '#fecfef');
        } else if (currentBackground.includes('#a8e6cf')) {
            gradient = tempBgCtx.createLinearGradient(0, 0, tempBgCanvas.width, tempBgCanvas.height);
            gradient.addColorStop(0, '#a8e6cf');
            gradient.addColorStop(1, '#dcedc1');
        } else if (currentBackground.includes('#ffd3a5')) {
            gradient = tempBgCtx.createLinearGradient(0, 0, tempBgCanvas.width, tempBgCanvas.height);
            gradient.addColorStop(0, '#ffd3a5');
            gradient.addColorStop(1, '#fd9853');
        } else if (currentBackground.includes('#a8caba')) {
            gradient = tempBgCtx.createLinearGradient(0, 0, tempBgCanvas.width, tempBgCanvas.height);
            gradient.addColorStop(0, '#a8caba');
            gradient.addColorStop(1, '#5d4e75');
        } else if (currentBackground.includes('#89f7fe')) {
            gradient = tempBgCtx.createLinearGradient(0, 0, tempBgCanvas.width, tempBgCanvas.height);
            gradient.addColorStop(0, '#89f7fe');
            gradient.addColorStop(1, '#66a6ff');
        } else if (currentBackground.includes('#fdbb2d')) {
            gradient = tempBgCtx.createLinearGradient(0, 0, tempBgCanvas.width, tempBgCanvas.height);
            gradient.addColorStop(0, '#fdbb2d');
            gradient.addColorStop(1, '#22c1c3');
        }
        
        if (gradient) {
            tempBgCtx.fillStyle = gradient;
            tempBgCtx.fillRect(0, 0, tempBgCanvas.width, tempBgCanvas.height);
            finalCtx.drawImage(tempBgCanvas, 0, 0);
        }
    }
    
    // Draw photo maintaining aspect ratio
    if (currentPhoto) {
        const tempImg = new Image();
        tempImg.onload = function() {
            // Apply filter to final canvas if set
            if (currentFilter !== 'none') {
                finalCtx.filter = img.style.filter;
            }
            
            // Apply blend mode if simple background is set
            if (currentBackground && typeof currentBackground === 'string' && currentBackground.includes('linear-gradient')) {
                finalCtx.globalCompositeOperation = 'multiply';
                finalCtx.globalAlpha = 0.85;
            }
            
            // Draw image to fill the canvas while maintaining aspect ratio
            finalCtx.drawImage(tempImg, 0, 0, finalCanvas.width, finalCanvas.height);
            
            // Reset composition settings
            finalCtx.globalCompositeOperation = 'source-over';
            finalCtx.globalAlpha = 1;
            finalCtx.filter = 'none';
            
            // Draw canvas drawings scaled proportionally
            const canvasData = canvas.toDataURL();
            const canvasImg = new Image();
            canvasImg.onload = function() {
                // Scale the drawing canvas to match the final canvas size
                const scaleX = finalCanvas.width / containerRect.width;
                const scaleY = finalCanvas.height / containerRect.height;
                
                const scaledCanvasWidth = canvas.width * scaleX;
                const scaledCanvasHeight = canvas.height * scaleY;
                
                finalCtx.drawImage(canvasImg, 0, 0, scaledCanvasWidth, scaledCanvasHeight);
                
                // Draw stickers with proportional positioning
                placedStickers.forEach(sticker => {
                    const stickerRect = sticker.getBoundingClientRect();
                    const relativeX = (stickerRect.left - containerRect.left) / containerRect.width;
                    const relativeY = (stickerRect.top - containerRect.top) / containerRect.height;
                    
                    const x = relativeX * finalCanvas.width;
                    const y = relativeY * finalCanvas.height;
                    
                    const fontSize = Math.min(finalCanvas.width, finalCanvas.height) * 0.08; // Proportional font size
                    finalCtx.font = `${fontSize}px Arial`;
                    finalCtx.textAlign = 'center';
                    finalCtx.textBaseline = 'middle';
                    finalCtx.fillText(sticker.textContent, x, y);
                });
            };
            canvasImg.src = canvasData;
        };
        tempImg.src = currentPhoto;
    }
}

function downloadPhoto() {
    const finalCanvas = document.getElementById('finalCanvas');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const link = document.createElement('a');
    link.download = `purikura-photo-${timestamp}.png`;
    link.href = finalCanvas.toDataURL('image/png', 1.0);
    
    // For mobile compatibility
    if (navigator.userAgent.match(/iPhone|iPad|iPod|Android/i)) {
        // Create a new window/tab to show the image
        const newWindow = window.open();
        newWindow.document.write(`
            <html>
                <head><title>Your Purikura Photo</title></head>
                <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#f0f0f0;">
                    <div style="text-align:center;">
                        <img src="${link.href}" style="max-width:100%; max-height:90vh;">
                        <br><br>
                        <p>Long press the image above to save it to your device!</p>
                    </div>
                </body>
            </html>
        `);
    } else {
        // Desktop download
        link.click();
    }
}

function startOver() {
    // Reset everything
    currentPhoto = null;
    currentBackground = null;
    currentFilter = 'none';
    originalPhotoData = null;
    placedStickers.forEach(sticker => sticker.remove());
    placedStickers = [];
    
    // Reset drawing history
    drawingHistory = [];
    historyIndex = -1;
    
    // Reset UI elements
    const img = document.getElementById('mainPhoto');
    img.style.display = 'none';
    img.style.filter = 'none';
    img.style.mixBlendMode = 'normal';
    img.style.opacity = '1';
    
    document.getElementById('placeholder').style.display = 'flex';
    document.getElementById('photoContainer').style.background = '#f0f0f0';
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveDrawingState();
    
    // Reset filter selection
    document.querySelectorAll('.filter-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelector('.filter-option').classList.add('selected');
    
    // Reset background selection
    document.querySelectorAll('.bg-option').forEach(opt => opt.classList.remove('selected'));
    
    // Reset color picker selection
    document.querySelectorAll('.color-picker').forEach(picker => {
        picker.style.border = '3px solid white';
    });
    
    // Reset steps
    document.getElementById('step3').classList.remove('active');
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step1').classList.add('active');
    
    document.getElementById('finalStep').classList.add('hidden');
    document.getElementById('editingStep').classList.add('hidden');
    
    // Clear file inputs
    document.getElementById('photoInput').value = '';
    document.getElementById('cameraInput').value = '';
    
    // Reset brush size
    document.getElementById('brushSize').value = 5;
    currentBrushSize = 5;
    currentColor = '#ff6b9d';
}

// Handle window resize
window.addEventListener('resize', () => {
    setTimeout(() => {
        setupCanvas();
        // Redraw current state if there's history
        if (drawingHistory.length > 0 && historyIndex >= 0) {
            restoreDrawingState();
        }
    }, 100);
});

// Prevent page scroll when drawing on mobile
document.addEventListener('touchmove', function(e) {
    if (e.target === canvas) {
        e.preventDefault();
    }
}, { passive: false });

// Add visual feedback for brush size
document.getElementById('brushSize').addEventListener('input', function(e) {
    const size = e.target.value;
    setBrushSize(size);
    
    // Show brush size preview
    const preview = document.createElement('div');
    preview.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${size * 2}px;
        height: ${size * 2}px;
        background: ${currentColor};
        border-radius: 50%;
        pointer-events: none;
        z-index: 1000;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(preview);
    setTimeout(() => preview.remove(), 1000);
});