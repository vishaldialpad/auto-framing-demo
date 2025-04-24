// ===== Constants =====
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

const ZOOM_FACTOR = 0.75;           // Target zoom level (90% of original frame)
const ZOOM_DURATION_MS = 800;      // Duration of zoom animation in ms

// ===== DOM Elements =====
const video = document.getElementById('webcam');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');

const toggleCentering = document.getElementById('toggleCentering');
const recenterBtn = document.getElementById('recenterBtn');

// ===== State Variables =====
let model;
let isCenteringEnabled = false;
let lockedCrop = null;

// ===== Initialize Webcam =====
async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    return new Promise(resolve => {
        video.onloadedmetadata = () => resolve();
    });
}

// ===== Detect Face and Calculate Subtle Crop =====
async function detectAndLockFrame() {
    const predictions = await model.estimateFaces(video, false);

    if (predictions.length === 0) {
        alert("No face detected. Please adjust your position and try again.");
        return false;
    }

    const face = predictions[0];
    const [x, y] = face.topLeft;
    const [x2, y2] = face.bottomRight;

    const faceCenterX = (x + x2) / 2;
    const faceCenterY = (y + y2) / 2;

    const cropW = VIDEO_WIDTH * ZOOM_FACTOR;
    const cropH = VIDEO_HEIGHT * ZOOM_FACTOR;

    let cropX = faceCenterX - cropW / 2;
    let cropY = faceCenterY - cropH / 2;

    cropX = Math.max(0, Math.min(cropX, VIDEO_WIDTH - cropW));
    cropY = Math.max(0, Math.min(cropY, VIDEO_HEIGHT - cropH));

    lockedCrop = { cropX, cropY, cropW, cropH };
    return true;
}

// ===== Animate Smooth Zoom =====
function animateZoom(startCrop, endCrop, duration = ZOOM_DURATION_MS) {
    const startTime = performance.now();

    function zoomStep(currentTime) {
        const elapsed = currentTime - startTime;
        const t = Math.min(elapsed / duration, 1);
        const easeT = 1 - Math.pow(1 - t, 3);  // Ease-out cubic

        const currentCrop = {
            cropX: startCrop.cropX + (endCrop.cropX - startCrop.cropX) * easeT,
            cropY: startCrop.cropY + (endCrop.cropY - startCrop.cropY) * easeT,
            cropW: startCrop.cropW + (endCrop.cropW - startCrop.cropW) * easeT,
            cropH: startCrop.cropH + (endCrop.cropH - startCrop.cropH) * easeT,
        };

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, currentCrop.cropX, currentCrop.cropY, currentCrop.cropW, currentCrop.cropH, 0, 0, canvas.width, canvas.height);

        if (t < 1) {
            requestAnimationFrame(zoomStep);
        } else {
            isCenteringEnabled = true;
        }
    }

    requestAnimationFrame(zoomStep);
}

// ===== Event Listeners =====
toggleCentering.addEventListener('change', async () => {
    if (toggleCentering.checked) {
        recenterBtn.disabled = false;
        const detected = await detectAndLockFrame();

        if (detected) {
            canvas.style.display = 'block';
            video.style.display = 'none';

            const fullFrame = { cropX: 0, cropY: 0, cropW: VIDEO_WIDTH, cropH: VIDEO_HEIGHT };
            animateZoom(fullFrame, lockedCrop);
        } else {
            toggleCentering.checked = false;
            recenterBtn.disabled = true;
        }
    } else {
        isCenteringEnabled = false;
        canvas.style.display = 'none';
        video.style.display = 'block';
        recenterBtn.disabled = true;
    }
});

recenterBtn.addEventListener('click', async () => {
    const detected = await detectAndLockFrame();
    if (detected) {
        const fullFrame = { cropX: 0, cropY: 0, cropW: VIDEO_WIDTH, cropH: VIDEO_HEIGHT };
        animateZoom(fullFrame, lockedCrop);
    }
});

// ===== Continuous Render Loop =====
function render() {
    requestAnimationFrame(render);
    if (isCenteringEnabled && lockedCrop) {
        const { cropX, cropY, cropW, cropH } = lockedCrop;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
    }
}

// ===== Initialize App =====
(async () => {
    await setupCamera();
    model = await blazeface.load();
    canvas.width = VIDEO_WIDTH;
    canvas.height = VIDEO_HEIGHT;
    render();
})();