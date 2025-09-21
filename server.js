// 필요한 라이브러리들을 불러옵니다.
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

// Express 앱과 Multer (파일 업로드 처리용)를 설정합니다.
const app = express();
const upload = multer({ dest: 'uploads/' }); // 이미지를 임시 저장할 폴더

// --- 중요 ---
// 이곳에 당신의 Google AI Studio API 키를 입력하세요.
// 키는 "..." 안에 실제 키를 붙여넣어야 합니다. (예: "AIzaSy...")
const API_KEY = "YOUR_GOOGLE_AI_API_KEY"; 
const genAI = new GoogleGenerativeAI(API_KEY);

// 기본 경로 ('/')로 접속했을 때 index.html 파일을 보여줍니다.
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// '/analyze' 경로로 이미지가 포함된 POST 요청이 왔을 때 AI 분석을 실행합니다.
app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "이미지 파일이 없습니다." });
        }

        // Gemini AI 모델을 선택합니다. 'gemini-pro-vision'은 이미지와 텍스트를 함께 이해할 수 있는 모델입니다.
        const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

        // AI에게 역할을 부여하고, 무엇을 분석할지 지시하는 프롬프트를 작성합니다.
        const prompt = "당신은 친절하고 전문적인 미술 선생님입니다. 이 그림을 보고, 학생의 실력 향상에 도움이 될 만한 긍정적인 피드백과 구체적인 개선점을 설명해주세요. 구도, 명암, 형태, 창의성 등을 종합적으로 고려해서요.";

        // 업로드된 이미지 파일을 Base64로 인코딩하여 AI가 읽을 수 있는 형태로 변환합니다.
        const imagePath = req.file.path;
        const imageBuffer = fs.readFileSync(imagePath);
        const imageBase64 = imageBuffer.toString('base64');

        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType: req.file.mimetype,
            },
        };

        // AI에게 프롬프트와 이미지를 함께 전달하여 분석을 요청합니다.
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const feedbackText = response.text();
        
        // 분석이 끝난 임시 이미지 파일을 삭제합니다.
        fs.unlinkSync(imagePath);

        // 생성된 피드백을 클라이언트(웹페이지)에 JSON 형태로 응답합니다.
        res.json({ feedback: feedbackText });

    } catch (error) {
        console.error("AI 분석 중 오류 발생:", error);
        res.status(500).json({ error: "AI 분석 중 오류가 발생했습니다." });
        // 오류 발생 시에도 임시 파일 삭제 시도
        if (req.file && req.file.path) {
            fs.unlinkSync(req.file.path);
        }
    }
});

// 3000번 포트에서 서버를 실행합니다.
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
