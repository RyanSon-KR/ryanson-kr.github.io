// --- HTTPS Redirection ---
if (location.protocol === 'http:' && location.hostname !== 'localhost') {
    location.replace('https://' + location.host + location.pathname);
}

// --- 중요 ---
// 백엔드 서버를 Vercel에 배포한 후, 발급받은 실제 서버 주소로 이 값을 변경해야 합니다.
const backendUrl = 'https://artb-backend.vercel.app';

// --- 전역 변수 및 DOM 요소 ---
const mobileMenuButton = document.getElementById('mobile-menu-button');
const mobileMenu = document.getElementById('mobile-menu');
const startCameraButton = document.getElementById('startCameraButton');
const uploadImageButton = document.getElementById('uploadImageButton');
const imageUploadInput = document.getElementById('imageUploadInput');
const dropZone = document.getElementById('drop-zone');
const cameraView = document.getElementById('camera-view');
const videoElement = document.getElementById('videoElement');
const canvasOverlay = document.getElementById('canvasOverlay');
const captureButton = document.getElementById('captureButton');
const closeCameraButton = document.getElementById('closeCameraButton');
const resultSection = document.getElementById('result-section');
const cameraError = document.getElementById('camera-error');
let stream = null;
let lastImageBlob = null;
let originalImageBlob = null;
let correctedImageBlob = null;
// cvLoaded는 head 스크립트에서 전역으로 선언됨
let processVideoTimeout;

// --- 모달 관련 DOM 요소 ---
const correctionChoiceModal = document.getElementById('correction-choice-modal');
const choiceOriginalImageEl = document.getElementById('choice-original-image');
const choiceCorrectedImageEl = document.getElementById('choice-corrected-image');
const analyzeOriginalBtn = document.getElementById('analyze-original-btn');
const analyzeCorrectedBtn = document.getElementById('analyze-corrected-btn');

const feedbackProgressModal = document.getElementById('feedback-progress-modal');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

const progressSteps = {
    step1: document.getElementById('step1'),
    step2: document.getElementById('step2'),
    step3: document.getElementById('step3'),
    step4: document.getElementById('step4'),
};

// --- 모바일 메뉴 ---
mobileMenuButton.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
});
document.querySelectorAll('.mobile-menu-link').forEach(link => {
    link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
});

// --- 파일 업로드 및 드래그 앤 드롭 기능 ---
uploadImageButton.addEventListener('click', () => imageUploadInput.click());

imageUploadInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) handleFile(file);
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
});

function handleFile(file) {
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                const corners = detectCornersFromCanvas(canvas);
                showCorrectionChoice(canvas, corners);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}


function detectCornersFromCanvas(canvas) {
    if (!cvLoaded) return null;
    let src = cv.imread(canvas);
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    let edges = new cv.Mat();
    cv.Canny(edges, gray, 50, 150);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let maxArea = 0;
    let bestContour = null;
    const minArea = (canvas.width * canvas.height) / 10;

    for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt);
        if (area > minArea) {
            let peri = cv.arcLength(cnt, true);
            let approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
            if (approx.rows === 4) {
                if (area > maxArea) {
                    maxArea = area;
                    bestContour = approx.clone();
                }
            }
            approx.delete();
        }
        cnt.delete();
    }

    let points = null;
    if (bestContour) {
        points = [];
        for(let i=0; i<4; i++){
            points.push({ x: bestContour.data32S[i * 2], y: bestContour.data32S[i * 2 + 1] });
        }
        bestContour.delete();
    }
    
    src.delete(); gray.delete(); edges.delete(); contours.delete(); hierarchy.delete();
    return points;
}


// --- 카메라 및 OpenCV 로직 ---
startCameraButton.addEventListener('click', async () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    clearTimeout(processVideoTimeout);
    cameraError.classList.add('hidden');
    resultSection.classList.add('hidden');
    
    if (!cvLoaded) {
        cameraError.textContent = "카메라 기능을 로드 중입니다. 잠시 후 다시 시도해주세요.";
        cameraError.classList.remove('hidden');
        return;
    }

    try {
        if (location.protocol !== 'https:' || !navigator.mediaDevices) {
            throw new Error('카메라는 보안 연결(HTTPS)된 페이지에서만 사용할 수 있습니다.');
        }
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        cameraView.classList.remove('hidden');
        startCameraButton.textContent = '카메라 재시작';
        videoElement.srcObject = stream;
        videoElement.onloadedmetadata = () => {
            resizeCanvas();
            processVideo(); 
        };
    } catch (err) {
        console.error("카메라 접근 오류:", err);
        cameraError.textContent = err.message || "카메라에 접근할 수 없습니다. 브라우저의 카메라 권한을 확인해주세요.";
        cameraError.classList.remove('hidden');
        cameraView.classList.add('hidden');
    }
});

function resizeCanvas() {
    if (!videoElement.videoWidth) return;
    const videoRect = videoElement.getBoundingClientRect();
    canvasOverlay.width = videoRect.width;
    canvasOverlay.height = videoRect.height;
}

window.addEventListener('resize', resizeCanvas);

lastDetectedCorners = null;

function processVideo() {
    if (!stream?.active || !cvLoaded) return;
    
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    if (videoWidth === 0 || videoHeight === 0) {
         processVideoTimeout = setTimeout(processVideo, 100);
         return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);

    let src = cv.imread(canvas);
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    let edges = new cv.Mat();
    cv.Canny(edges, gray, 50, 150);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let maxArea = 0;
    let bestContour = null;
    const minArea = (videoWidth * videoHeight) / 10;

    for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt);
        if (area > minArea) {
            let peri = cv.arcLength(cnt, true);
            let approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
            if (approx.rows === 4) {
                if (area > maxArea) {
                    maxArea = area;
                    bestContour = approx.clone();
                }
            }
            approx.delete();
        }
        cnt.delete();
    }

    const overlayCtx = canvasOverlay.getContext('2d');
    overlayCtx.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);

    if (bestContour) {
        const points = [];
        for(let i=0; i<4; i++){
            points.push({
                x: bestContour.data32S[i * 2] * (canvasOverlay.width / videoWidth),
                y: bestContour.data32S[i * 2 + 1] * (canvasOverlay.height / videoHeight)
            });
        }
        lastDetectedCorners = points; 

        overlayCtx.beginPath();
        overlayCtx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < 4; i++) {
            overlayCtx.lineTo(points[i].x, points[i].y);
        }
        overlayCtx.closePath();
        overlayCtx.strokeStyle = 'rgba(74, 222, 128, 0.9)';
        overlayCtx.lineWidth = 4;
        overlayCtx.stroke();
        
        bestContour.delete();
    } else {
         lastDetectedCorners = null;
    }
    
    src.delete(); gray.delete(); edges.delete(); contours.delete(); hierarchy.delete();
    
    processVideoTimeout = setTimeout(processVideo, 50); 
}

captureButton.addEventListener('click', () => {
    clearTimeout(processVideoTimeout);
    
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    cameraView.classList.add('hidden');
    
    showCorrectionChoice(canvas, lastDetectedCorners);
});

closeCameraButton.addEventListener('click', () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    clearTimeout(processVideoTimeout);
    cameraView.classList.add('hidden');
    cameraError.classList.add('hidden');
    startCameraButton.textContent = '카메라로 작품 촬영하기';
});

function showCorrectionChoice(originalCanvas, corners) {
    originalCanvas.toBlob(blob => {
        originalImageBlob = blob;
        if (!corners) {
            console.log("자동 보정 실패, 원본 이미지로 분석을 시작합니다.");
            startAiAnalysis(originalImageBlob);
            return;
        }
        
        choiceOriginalImageEl.src = URL.createObjectURL(blob);
        
        let src = cv.imread(originalCanvas);
        corners.sort((a,b) => a.y - b.y);
        const topPoints = [corners[0], corners[1]].sort((a, b) => a.x - b.x);
        const bottomPoints = [corners[2], corners[3]].sort((a, b) => a.x - b.x);
        const sortedCorners = [...topPoints, ...bottomPoints];

        const dsize = new cv.Size(originalCanvas.width, originalCanvas.height);
        let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
            sortedCorners[0].x, sortedCorners[0].y,
            sortedCorners[1].x, sortedCorners[1].y,
            sortedCorners[3].x, sortedCorners[3].y,
            sortedCorners[2].x, sortedCorners[2].y
        ]);
        let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, dsize.width, 0, dsize.width, dsize.height, 0, dsize.height]);
        let M = cv.getPerspectiveTransform(srcTri, dstTri);
        let dst = new cv.Mat();
        cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
        
        const correctedCanvas = document.createElement('canvas');
        cv.imshow(correctedCanvas, dst);
        choiceCorrectedImageEl.src = correctedCanvas.toDataURL('image/jpeg');
        correctedCanvas.toBlob(blob => { correctedImageBlob = blob; }, 'image/jpeg');
        
        src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
        
        correctionChoiceModal.classList.remove('hidden');
    }, 'image/jpeg');
}

analyzeOriginalBtn.addEventListener('click', () => startAiAnalysis(originalImageBlob));
analyzeCorrectedBtn.addEventListener('click', () => startAiAnalysis(correctedImageBlob));

async function startAiAnalysis(imageBlob) {
    correctionChoiceModal.classList.add('hidden');
    feedbackProgressModal.classList.remove('hidden');
    
    // 프로그레스 바 및 스텝 초기화
    updateProgress(0);
    Object.values(progressSteps).forEach(step => step.className = 'progress-step pending');
    
    setTimeout(() => {
        updateProgressStep('step1', 'active', 'AI 분석 요청');
        updateProgress(10);
    }, 100);
    
    submitForAnalysis(imageBlob);
}

function updateProgress(percentage) {
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `진행도: ${percentage}%`;
}

function updateProgressStep(stepId, status, text) {
    const step = progressSteps[stepId];
    if (!step) return;
    step.className = 'progress-step';
    step.classList.add(status);
    step.querySelector('p').textContent = text;
}

async function submitForAnalysis(imageBlob) {
    lastImageBlob = imageBlob;
    
    const formData = new FormData();
    formData.append('image', imageBlob, 'artwork.jpg');

    try {
        const response = await fetch(`${backendUrl}/analyze`, { method: 'POST', body: formData });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`서버 오류: ${errorData.error || response.statusText}`);
        }
        
        updateProgressStep('step1', 'completed', 'AI 분석 요청 완료');
        updateProgress(25);
        setTimeout(() => {
             updateProgressStep('step2', 'active', '구도 및 형태 평가');
             updateProgress(50);
        }, 500);

        const result = await response.json();
        
        updateProgressStep('step2', 'completed', '구도 및 형태 평가 완료');
        setTimeout(() => {
            updateProgressStep('step3', 'active', '명암 및 채색 평가');
            updateProgress(75);
        }, 500);
        setTimeout(() => {
            updateProgressStep('step3', 'completed', '명암 및 채색 평가 완료');
            updateProgressStep('step4', 'active', '최종 피드백 생성');
            updateProgress(90);
        }, 1000);
        
        setTimeout(() => {
            updateProgressStep('step4', 'completed', '최종 피드백 생성 완료!');
            updateProgress(100);
            setTimeout(() => {
                feedbackProgressModal.classList.add('hidden');
                displayResults({
                    processed_image_url: URL.createObjectURL(imageBlob),
                    ai_feedback: { feedback_text: result.feedback }
                });
            }, 500);
        }, 1500);

    } catch (error) {
        feedbackProgressModal.classList.add('hidden');
        console.error("분석 요청 실패:", error);
        cameraError.textContent = `AI 분석에 실패했습니다: ${error.message}`;
        cameraError.classList.remove('hidden');
    }
}

function formatFeedbackToHtml(text, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = ''; 

    const lines = text.split('\n').filter(line => line.trim() !== '');
    let html = '';
    
    const itemRegex = /\[(.*?)\]\s*-\s*(.*)/;
    const totalScoreRegex = /👉\s*\*\*종합 평가:\s*(.*?)\*\*/;
    const summaryRegex = /\*\*총평:\*\*\s*(.*)/;
    const suggestionRegex = /\[상세 제안\]\s*-\s*(.*)/;

    let i = 0;
    while(i < lines.length) {
        const line = lines[i];
        const itemMatch = line.match(itemRegex);
        
        if (itemMatch) {
            const fullTitle = itemMatch[1].trim();
            const content = itemMatch[2].trim();
            const scoreRegex = /(.*?):\s*(\d+\.?\d*)\/10/;
            const titleScoreMatch = fullTitle.match(scoreRegex);
            
            let suggestion = '';
            if (i + 1 < lines.length && lines[i+1].match(suggestionRegex)) {
                suggestion = lines[i+1].match(suggestionRegex)[1].trim();
                i++;
            }

            if (titleScoreMatch) {
                const title = titleScoreMatch[1].trim();
                const score = titleScoreMatch[2];
                html += `
                <div class="evaluation-item">
                    <div class="evaluation-header" onclick="toggleDetails(this)">
                        <span class="evaluation-item-title">${title}</span>
                        <div class="flex items-center">
                            <span class="evaluation-score mr-2">${score}/10</span>
                            <svg class="toggle-arrow h-5 w-5 transition-transform" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                        </div>
                    </div>
                    <div class="evaluation-details hidden mt-2 pt-4 border-t border-slate-200">
                        <p>${content}</p>
                        ${suggestion ? `<div class="mt-4 p-3 bg-indigo-50 rounded-md">
                            <h5 class="font-semibold text-indigo-800">수정 제안</h5>
                            <p class="text-indigo-700 text-sm mt-1">${suggestion}</p>
                        </div>` : ''}
                    </div>
                </div>`;
            }
        } else {
             const totalScoreMatch = line.match(totalScoreRegex);
             const summaryMatch = line.match(summaryRegex);
             if (totalScoreMatch) {
                html += `<div class="mt-6 pt-4 border-t border-slate-200 text-center">
                             <h4 class="text-lg font-semibold text-slate-700">종합 평가</h4>
                             <p class="text-3xl font-bold text-indigo-600 mt-2">${totalScoreMatch[1].trim()}</p>
                          </div>`;
             } else if (summaryMatch) {
                html += `<div class="mt-4 text-center"><p class="text-slate-600">${summaryMatch[1].trim()}</p></div>`;
             }
        }
        i++;
    }
    container.innerHTML = html;
}

function toggleDetails(element) {
    const details = element.nextElementSibling;
    const arrow = element.querySelector('.toggle-arrow');
    details.classList.toggle('open');
    arrow.classList.toggle('open');
}

function displayResults(data) {
    resultSection.classList.remove('hidden');
    document.getElementById('processedImage').src = data.processed_image_url;
    formatFeedbackToHtml(data.ai_feedback.feedback_text, 'ai-feedback-text');
    document.getElementById('style-analysis-container').classList.remove('hidden');
    document.getElementById('style-result').classList.add('hidden');
}

const styleAnalysisButton = document.getElementById('styleAnalysisButton');
const styleLoading = document.getElementById('style-loading');
const styleResult = document.getElementById('style-result');
const styleResultText = document.getElementById('style-result-text');

styleAnalysisButton.addEventListener('click', async () => {
    if (!lastImageBlob) return;
    styleLoading.classList.remove('hidden');
    styleResult.classList.add('hidden');
    styleAnalysisButton.disabled = true;

    const formData = new FormData();
    formData.append('image', lastImageBlob, 'artwork.jpg');

    try {
        const response = await fetch(`${backendUrl}/analyze-style`, {
            method: 'POST', body: formData,
        });
        if (!response.ok) {
             const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`스타일 분석에 실패했습니다: ${errorData.error || response.statusText}`);
        }
        const result = await response.json();
        formatFeedbackToHtml(result.style_feedback, 'style-result-text');
        styleResult.classList.remove('hidden');
    } catch (error) {
        console.error('스타일 분석 오류:', error);
        alert(error.message);
    } finally {
        styleLoading.classList.add('hidden');
        styleAnalysisButton.disabled = false;
    }
});

// --- Form Submissions ---
const surveyForm = document.getElementById('artb-survey-form');
const surveyContainer = document.getElementById('survey-container');
const surveyThanks = document.getElementById('survey-thanks');
if(surveyForm) {
    surveyForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(surveyForm);
        const interests = formData.getAll('interest');
        const data = { role: formData.get('role'), interests: interests, feedback_text: formData.get('feedback_text')};
        try {
            const response = await fetch(`${backendUrl}/survey`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('서버에 문제가 발생했습니다.');
            surveyContainer.classList.add('hidden');
            surveyThanks.classList.remove('hidden');
        } catch (error) {
            console.error('설문 제출 오류:', error);
            alert('설문 제출에 실패했습니다. 잠시 후 다시 시도해주세요.');
        }
    });
}

const contactForm = document.getElementById('contact-form');
const contactContainer = document.getElementById('contact-container');
const contactThanks = document.getElementById('contact-thanks');
if(contactForm) {
    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData.entries());
        try {
            const response = await fetch(`${backendUrl}/contact`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('문의 제출에 실패했습니다.');
            contactContainer.classList.add('hidden');
            contactThanks.classList.remove('hidden');
        } catch (error) {
            console.error('문의 제출 오류:', error);
            alert(error.message);
        }
    });
}

const preregisterForm = document.getElementById('preregister-form');
const ctaContainer = document.getElementById('cta-container');
const ctaThanks = document.getElementById('cta-thanks');
if(preregisterForm){
    preregisterForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(preregisterForm);
        const data = Object.fromEntries(formData.entries());
        try {
            const response = await fetch(`${backendUrl}/preregister`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('사전 등록에 실패했습니다.');
            ctaContainer.classList.add('hidden');
            ctaThanks.classList.remove('hidden');
        } catch (error) {
            console.error('사전 등록 오류:', error);
            alert(error.message);
        }
    });
}

// --- 스크롤 애니메이션 로직 ---
const scrollObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
        } else {
            entry.target.classList.remove('is-visible');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.scroll-fade-in').forEach(el => {
    scrollObserver.observe(el);
});

// --- Feature Modals Logic ---
const featureAi = document.getElementById('feature-ai');
const featureExpert = document.getElementById('feature-expert');
const featurePortfolio = document.getElementById('feature-portfolio');
const modalAi = document.getElementById('modal-ai');
const modalExpert = document.getElementById('modal-expert');
const modalPortfolio = document.getElementById('modal-portfolio');

function openModal(modal) { modal.classList.remove('hidden'); }
function closeModal(modal) { modal.classList.add('hidden'); }

featureAi.addEventListener('click', () => openModal(modalAi));
featureExpert.addEventListener('click', () => openModal(modalExpert));
featurePortfolio.addEventListener('click', () => openModal(modalPortfolio));

document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        closeModal(e.target.closest('.modal-backdrop'));
    });
});
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            closeModal(backdrop);
        }
    });
});

// --- Portfolio Gallery Logic ---
const portfolioGallery = document.getElementById('portfolio-gallery');
const portfolioModal = document.getElementById('portfolio-comparison-modal');
const closePortfolioModalBtn = document.getElementById('close-comparison-modal');
const portfolioModalOriginalImage = document.getElementById('comparison-original-image');
const portfolioModalRevisedImage = document.getElementById('comparison-revised-image');
const portfolioModalInitialFeedback = document.getElementById('comparison-initial-feedback');
const portfolioModalImprovementFeedback = document.getElementById('comparison-improvement-feedback');

const portfolioData = [
    { id: 2, originalImage: 'https://placehold.co/600x600/fbbf24/b45309?text=Artwork+2+(Before)', revisedImage: 'https://placehold.co/600x600/fde047/b45309?text=Artwork+2+(After)', initialFeedback: '[기술적 완성도: 7/10] - 안정적인 구도와 섬세한 묘사가 돋보이는 정물화입니다.\n[표현력: 6/10] - 배경 처리가 다소 단조로워 보입니다. 배경에 약간의 변화를 주면 그림의 깊이감이 더 살아날 것입니다.', improvementFeedback: '👉 **종합 평가: 8.5/10**\n**총평:** 이전 피드백을 훌륭하게 반영했습니다! **배경에 명암 단계를 추가**하여 주제부가 더 돋보이고, **공간의 깊이감**이 훨씬 풍부해졌습니다. 덕분에 그림의 전체적인 완성도가 크게 향상되었습니다.' },
];

const galleryItems = [
    { id: 1, image: 'https://placehold.co/600x600/a3e635/4d7c0f?text=Artwork+1'},
    portfolioData[0],
    { id: 3, image: 'https://placehold.co/600x600/60a5fa/1e40af?text=Artwork+3'},
    { id: 4, image: 'https://placehold.co/600x600/f87171/991b1b?text=Artwork+4'},
];


galleryItems.forEach(item => {
    const div = document.createElement('div');
    div.className = 'portfolio-item';
    div.innerHTML = `
        <img src="${item.revisedImage || item.image}" alt="Portfolio artwork ${item.id}">
        <div class="overlay">작품 ${item.id} ${item.revisedImage ? '(성장 기록 보기)' : ''}</div>
    `;
    portfolioGallery.appendChild(div);

    div.addEventListener('click', () => {
        if (item.revisedImage) { 
            portfolioModalOriginalImage.src = item.originalImage;
            portfolioModalRevisedImage.src = item.revisedImage;
            formatFeedbackToHtml(item.initialFeedback, 'comparison-initial-feedback');
            formatFeedbackToHtml(item.improvementFeedback, 'comparison-improvement-feedback');
            openModal(portfolioModal);
        }
    });
});

closePortfolioModalBtn.addEventListener('click', () => closeModal(portfolioModal));
portfolioModal.addEventListener('click', (e) => {
    if (e.target === portfolioModal) {
        closeModal(portfolioModal);
    }
});

    </script>
</body>
</html>

