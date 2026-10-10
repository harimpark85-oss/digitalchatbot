# Artificial Languages — 공개 배포판 (Claude 로그인 없이)

방문자의 브라우저는 이 사이트의 `/api/sample`에만 요청합니다. 서버 함수(`api/sample.js`)가 작가의 API 키로 Claude를 호출합니다. 키는 Vercel 환경변수에만 있고, 브라우저로는 절대 전달되지 않습니다.

## 파일
| 파일 | 역할 |
|---|---|
| `index.html` | 작품 본체 (claude.ai 아티팩트와 동일한 코드 + 맨 위에 shim 한 줄) |
| `claude-shim.js` | `window.claude.use("sample")`를 `/api/sample` 호출로 바꿔주는 작은 스크립트 |
| `api/sample.js` | Vercel 서버 함수: Claude 호출, 요청 제한, JSON 처리 |
| `package.json`, `vercel.json` | 의존성(@anthropic-ai/sdk)과 함수 설정 |

## 1. Anthropic API 키 만들기
1. https://console.anthropic.com 가입 → **Billing**에서 결제수단 등록, 크레딧 충전
2. **Settings → Limits**에서 **월 지출 한도(spend limit)** 를 꼭 설정 (예: $30). 이것이 진짜 안전장치입니다.
3. **API Keys → Create Key** → 키 복사 (한 번만 보여요. 어디에도 공개하지 마세요)

## 2. GitHub에 올리기 (설치 없이 웹에서)
1. https://github.com 가입 → 오른쪽 위 **+ → New repository** → 이름 예: `artificial-languages` → Public/Private 아무거나 → Create
2. **uploading an existing file** 링크 클릭 → 이 폴더의 파일을 모두 드래그 (`api` 폴더째로) → **Commit changes**

## 3. Vercel에 배포
1. https://vercel.com → **Continue with GitHub**로 가입
2. **Add New → Project** → 방금 만든 저장소 **Import**
3. Framework Preset: **Other** (빌드 설정은 비워둠)
4. **Environment Variables**에 추가:
   - `ANTHROPIC_API_KEY` = 1단계에서 복사한 키
5. **Deploy** → 1분쯤 뒤 `https://artificial-languages-xxxx.vercel.app` 같은 주소가 나옵니다.

## 4. 확인
주소를 로그인 안 된 브라우저(시크릿 창)에서 열고, 무선호출기 모드에서 숫자를 보내 답이 오는지 확인하세요. 오류가 나면 Vercel 프로젝트의 **Logs** 탭을 보면 됩니다.

## 선택 환경변수
| 이름 | 기본값 | 설명 |
|---|---|---|
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | 다른 모델로 바꾸고 싶을 때 (예: `claude-sonnet-5-5`, `claude-haiku-5-5` — 더 싸고 빠르지만 품질이 달라질 수 있음) |
| `ANTHROPIC_EFFORT` | `medium` | `low`로 하면 응답이 빨라지고 저렴해짐 |
| `PER_IP_LIMIT` | `40` | 방문자 1명(IP)당 10분에 보낼 수 있는 요청 수 |
| `DAILY_LIMIT` | `2000` | 서버 인스턴스당 하루 요청 상한 (참고용, 확실한 상한은 Console의 지출 한도) |
| `ALLOWED_ORIGIN` | (없음) | 예: `https://artificial-languages-xxxx.vercel.app` — 다른 사이트에서 이 API를 쓰는 걸 막음 |

환경변수를 바꾼 뒤에는 Vercel **Deployments → … → Redeploy** 해야 반영됩니다.

## 작품을 수정했을 때
claude.ai 아티팩트를 편집용 원본으로 계속 쓰세요. 수정이 끝나면 Claude에게 "배포판 index.html 다시 만들어줘"라고 하면 됩니다. 그 `index.html`만 GitHub 저장소에 다시 업로드(같은 이름으로 덮어쓰기 → Commit)하면 Vercel이 자동으로 재배포합니다.

## 주의
- 이 API는 작품이 보내는 프롬프트를 그대로 Claude에 전달하므로, 누군가 주소를 알면 직접 호출해 크레딧을 쓸 수 있습니다. 요청 제한 + `ALLOWED_ORIGIN` + **Console 지출 한도**로 막습니다.
- 서버 측 fallback(`server-side-fallback`)이 켜져 있어서, 기본 모델이 과부하일 때 Anthropic이 대체 모델로 자동 재시도합니다.
