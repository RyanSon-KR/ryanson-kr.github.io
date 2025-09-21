## Artb 실제 AI 기능 실행 가이드
안녕하세요! 이 가이드는 시뮬레이션 데모를 넘어, 실제 Google AI가 작동하는 Artb 웹사이트를 당신의 컴퓨터에서 실행하는 방법을 안내합니다.
---
### 1. 기본 개념: 왜 두 개의 파일이 필요한가요?
index.html (프론트엔드): 우리 눈에 보이는 웹사이트입니다. 사용자의 요청(이미지 촬영)을 받아 서버에 전달하는 '창구' 역할을 합니다.

server.js (백엔드): 보이지 않는 곳에서 일하는 'AI 두뇌'입니다. 프론트엔드에서 이미지를 받아, 진짜 AI에게 분석을 시키고, 그 결과를 다시 프론트엔드로 보내줍니다.


라이선스 제공자: Google
### 2. 준비물 (Prerequisites)
Node.js 설치: 백엔드 서버(server.js)를 실행하기 위한 필수 프로그램입니다.

nodejs.org 에 접속하여 LTS 버전을 다운로드하여 설치해주세요. (설치 시 계속 'Next'만 누르면 됩니다.)

Google AI API 키 발급: Gemini AI를 사용하기 위한 '비밀 열쇠'입니다.

Google AI Studio 에 접속하여 Google 계정으로 로그인합니다.

[Create API key in new project] 버튼을 눌러 새로운 API 키를 생성합니다.

생성된 키(긴 문자열)를 복사하여 안전한 곳에 잠시 보관해두세요. 이 키는 절대 외부에 노출되면 안 됩니다.

### 3. 설치 및 실행 단계
프로젝트 폴더 생성:

컴퓨터 바탕화면 등에 artb-project 와 같은 이름으로 새 폴더를 만듭니다.

다운로드한 index.html과 server.js 두 파일을 이 폴더 안에 넣습니다.

터미널(명령 프롬프트) 열기:

Windows: artb-project 폴더 안에서 Shift 키를 누른 채 마우스 오른쪽 버튼을 클릭 후, '여기에 PowerShell 창 열기' 또는 **'명령 프롬프트 열기'**를 선택합니다.

Mac: artb-project 폴더를 열고, 상단 메뉴에서 **[폴더] > [서비스] > [폴더에서 새로운 터미널 열기]**를 선택합니다.

필요한 라이브러리 설치:

열린 터미널 창에 아래 명령어를 한 줄씩 입력하고 엔터를 누릅니다.

npm init -y
npm install express multer @google/generative-ai

API 키 입력:

폴더에 있는 server.js 파일을 메모장이나 코드 에디터로 엽니다.

파일 상단의 const API_KEY = "YOUR_GOOGLE_AI_API_KEY"; 부분을 찾습니다.

"YOUR_GOOGLE_AI_API_KEY" 대신, 아까 발급받았던 실제 당신의 API 키를 따옴표 안에 붙여넣고 저장합니다.

서버 실행:

다시 터미널 창으로 돌아와 아래 명령어를 입력하고 엔터를 누릅니다.

node server.js
