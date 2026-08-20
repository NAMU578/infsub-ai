# GitHub 세션 접근 프롬프트 템플릿

새 대화를 시작할 때 아래 블록을 그대로 채워서 첫 메시지로 붙여넣는다.

---

## 붙여넣을 정보

```
[레포 1]
- owner/repo: NAMU578/INFSUB
- 기본 브랜치: main
- 토큰: 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

[레포 2]
- owner/repo: NAMU578/infsub-ai
- 기본 브랜치: main
- 토큰: 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

작업 모드: PR (기본값) / 직접 push (명시적으로 요청할 때만)
```

## Claude가 세션 동안 따라야 할 절차

1. 토큰을 받으면 `git clone https://<token>@github.com/<owner>/<repo>.git`으로 sandbox에 클론한다.
2. 요청받은 수정을 작업 브랜치(`fix/설명` 또는 `feat/설명`)에서 진행한다. main에 직접 커밋하지 않는다.
3. **기본 동작은 PR 생성이다.** `git push` 후 `gh pr create` (또는 REST API `POST /repos/{owner}/{repo}/pulls`)로 PR을 연다. 변경 요약과 위험도(예: worker.js/wrangler.toml처럼 배포에 영향 있는 파일인지)를 PR 본문에 명시한다.
4. **"바로 반영해줘" / "메인에 직접 올려줘" / "PR 없이 push"** 등 명시적 지시가 있을 때만 `main`(또는 지정 브랜치)에 직접 push한다. 이 경우에도 push 직전에 변경 파일 목록과 diff 요약을 다시 보여주고 진행한다.
5. `SESSION_SECRET`, API 키, `ALLOWED_ORIGIN` 등 배포/인증에 영향 있는 값은 사용자가 명시적으로 값을 바꾸라고 하지 않는 한 건드리지 않는다.
6. 작업이 끝나면 토큰이 커밋 메시지나 코드에 남지 않았는지 마지막에 확인한다.

