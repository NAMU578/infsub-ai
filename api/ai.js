/* Vercel 서버리스 함수 — /api/ai
   Cloudflare Worker의 /ai 부분만 그대로 옮긴 것입니다.
   실행 위치가 미국 리전(iad1 등)이라 Anthropic 쪽 지역 차단에
   걸리지 않을 가능성이 높습니다. 나머지(로그인, 저장, 채점 이외 기능)는
   그대로 Cloudflare Worker 가 처리합니다.

   반드시 Vercel 프로젝트 설정 → Environment Variables 에서
     ANTHROPIC_API_KEY   (필수)
     MODEL               (선택, 기본 claude-sonnet-5)
     ALLOWED_ORIGIN       (선택, 기본 https://namu578.github.io)
   를 넣어 주세요. Cloudflare Worker 시크릿과는 별개로 여기 새로 넣어야 합니다. */

const MAKE_SYS = `너는 한국 고등학교 정보 과목의 출제 교사다.
주어진 수업 노트북 내용에서 핵심 개념 하나를 골라 서술형 문제 1개를 낸다.

규칙
- 한국어로 쓴다.
- 노트북에 실제로 나온 개념만 다룬다. 노트북 밖 지식을 요구하지 않는다.
- 주어진 설명과 코드 조각만 보고 답할 수 있어야 한다. 노트북의 다른 셀이나 앞뒤 맥락을 알아야만 풀리는 문제는 절대 내지 않는다.
- 문제 안에 필요한 정보를 모두 담는다. "위에서 만든 배열", "아까 정의한 함수"처럼 화면에 없는 것을 가리키지 않는다.
- 서술형이므로 답이 한 단어로 끝나면 안 된다. "왜", "어떻게", "무슨 차이", "어떤 일이 일어나는지" 같은 설명을 요구한다.
- 코드가 필요하면 code 필드에 짧은 파이썬 코드를 넣고, 필요 없으면 빈 문자열로 둔다.
- rubric에는 정답으로 인정할 핵심 요소를 2~4개 적는다.

출력은 아래 형태의 JSON 하나뿐이다. 설명, 인사말, 마크다운 코드펜스를 절대 붙이지 않는다.
{"question":"...","code":"","rubric":"...","model_answer":"..."}`;

const GRADE_SYS = `너는 한국 고등학교 정보 과목의 채점 교사다. 학생 답안을 채점 기준에 비추어 평가한다.

규칙
- 한국어로 쓴다.
- 핵심 요소를 대체로 담았으면 맞은 것으로 본다. 표현이 서툴러도 뜻이 맞으면 인정한다.
- feedback은 두 문장 이내로, 무엇이 좋았고 무엇이 빠졌는지 구체적으로 짚는다. 학생을 깎아내리지 않는다.
- model_answer에는 모범 답안을 세 문장 이내로 쓴다.

출력은 아래 형태의 JSON 하나뿐이다. 설명, 인사말, 마크다운 코드펜스를 절대 붙이지 않는다.
{"correct":true,"feedback":"...","model_answer":"..."}`;

class HttpError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function callClaude(env, system, user, maxTokens = 1200) {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) throw new HttpError('서술형 기능이 설정되지 않았습니다 (ANTHROPIC_API_KEY 없음)', 503);

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key.trim(),
      'anthropic-version': '2023-06-01',
      'user-agent': 'INFSUB/1.0 (+https://namu578.github.io/INFSUB)',
    },
    body: JSON.stringify({
      model: env.MODEL || 'claude-sonnet-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    if (r.status === 401) throw new HttpError('Claude API 키가 올바르지 않습니다.', 502);
    if (r.status === 403) throw new HttpError('Claude API가 이 요청을 거부했습니다 (403). 결제·권한을 확인해 주세요.', 502);
    if (r.status === 404) throw new HttpError(`요청한 모델을 찾을 수 없습니다 (${env.MODEL || 'claude-sonnet-5'}).`, 502);
    if (r.status === 429) throw new HttpError('요청이 몰렸습니다. 잠시 뒤 다시 시도해 주세요.', 502);
    throw new HttpError(`Claude 호출 실패 (${r.status}) ${t.slice(0, 160)}`, 502);
  }

  const j = await r.json();
  const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); }
  catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    throw new HttpError('AI 응답을 이해하지 못했습니다. 다시 시도해 주세요.', 502);
  }
}

async function runTask(env, body) {
  if (body.task === 'make') {
    const ctx = String(body.context || '').slice(0, 6000);
    if (!ctx.trim()) throw new HttpError('노트북 내용이 비어 있습니다', 400);
    return await callClaude(env, MAKE_SYS,
      `노트북 이름: ${String(body.notebook || '').slice(0, 80)}\n\n=== 노트북 내용 ===\n${ctx}`);
  }
  if (body.task === 'grade') {
    return await callClaude(env, GRADE_SYS,
      `문제: ${String(body.question || '').slice(0, 1500)}\n\n채점 기준: ${String(body.rubric || '').slice(0, 1500)}\n\n학생 답안: ${String(body.answer || '').slice(0, 3000)}`,
      700);
  }
  throw new HttpError('알 수 없는 요청입니다', 400);
}

module.exports = async (req, res) => {
  const origin = process.env.ALLOWED_ORIGIN || 'https://namu578.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST만 허용됩니다' }); return; }

  try {
    const body = typeof req.body === 'object' && req.body ? req.body
      : JSON.parse(req.body || '{}');
    const result = await runTask(process.env, body);
    res.status(200).json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || '서버 오류' });
  }
};
