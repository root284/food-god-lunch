# 음식의 신

오늘의 기분을 맡길 음식신을 고르면 운세처럼 점심 메뉴를 추천하는 내부용 웹앱 프로토타입입니다.

## 로컬 실행

```bash
npm start
```

브라우저에서 `http://localhost:3000`을 엽니다.

API 키가 없으면 서버가 로컬 fallback 점괘를 반환합니다. AI 응답을 쓰려면 환경변수를 설정합니다.

```bash
OPENAI_API_KEY=sk-... npm start
```

## Railway 배포

1. 이 폴더를 GitHub 저장소로 push합니다.
2. Railway에서 `New Project` → `Deploy from GitHub repo`를 선택합니다.
3. Variables에 `OPENAI_API_KEY`를 추가합니다.
4. 필요하면 `OPENAI_MODEL`도 추가합니다. 기본값은 `gpt-4o-mini`입니다.
5. Railway가 `npm start`로 서버를 실행합니다.

브라우저는 API 키를 직접 보관하지 않고 `/api/fortune`만 호출합니다.
