# 랜덤 로또

개인 연습용 웹사이트입니다. 로또 번호 생성기, 고정 번호 생성, 최근 당첨번호 조회, 한강 수온 조회, Firebase Firestore 기반 방명록 기능을 포함합니다.

방명록은 Firebase Firestore에 저장되며, Google 로그인한 관리자만 방명록 글을 삭제할 수 있습니다.

## 실행 방법

```bash
npm install
npm run dev
```

배포용 파일을 만들려면 아래 명령을 실행합니다.

```bash
npm run build
```

Firebase Hosting에 배포할 때는 아래 명령을 실행합니다.

```bash
npm run deploy
```

배포 URL은 `https://minsu-profile-practice.web.app`입니다.

## 환경 변수

`.env.example`을 복사해 `.env`를 만들고 Firebase Web App 설정 값을 채워 넣습니다. `.env`는 커밋하지 않습니다.

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_ADMIN_EMAIL=
```

`VITE_ADMIN_EMAIL`은 화면에서 관리자 삭제 버튼을 보여줄 계정입니다. 실제 삭제 권한은 `firestore.rules`의 `isAdmin()` 조건과도 같아야 합니다.

## 프로젝트 구조

- `src/main.js`: 앱 로직과 Firebase 연결
- `src/styles.css`: 화면 스타일
- `index.html`: 앱 HTML
- `public/`: 정적 파일 위치
- `firebase.json`: Firebase Hosting 및 Firestore rules 설정
- `firestore.rules`: 방명록 읽기/쓰기/관리자 삭제 규칙
