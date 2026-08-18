# GitHub 세션 접근 프롬프트 템플릿

새 대화를 시작할 때 아래 블록을 그대로 채워서 첫 메시지로 붙여넣는다.
토큰은 이 세션의 sandbox 안에서만 쓰이고, 대화가 끝나면 사라진다. 지침/메모리에는 절대 넣지 않는다.

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

## 토큰 발급 조건 (매번 발급 시 지킬 것)

- GitHub → Settings → Developer settings → Fine-grained personal access token
- Repository access: 해당 레포 하나로 한정 (전체 계정 접근 금지)
- Permissions: Contents (Read/Write), Pull requests (Read/Write) 만 부여
- 만료기간: 짧게 (1일~7일 권장)

## Claude가 세션 동안 따라야 할 절차

1. 토큰을 받으면 `git clone https://<token>@github.com/<owner>/<repo>.git`으로 sandbox에 클론한다. (URL에 토큰이 남으므로 clone 후 `git remote set-url origin https://github.com/<owner>/<repo>.git`으로 즉시 토큰을 remote URL에서 제거하고, 별도 credential helper나 push 시점 임시 사용으로 전환한다.)
2. 요청받은 수정을 작업 브랜치(`fix/설명` 또는 `feat/설명`)에서 진행한다. main에 직접 커밋하지 않는다.
3. **기본 동작은 PR 생성이다.** `git push` 후 `gh pr create` (또는 REST API `POST /repos/{owner}/{repo}/pulls`)로 PR을 연다. 변경 요약과 위험도(예: worker.js/wrangler.toml처럼 배포에 영향 있는 파일인지)를 PR 본문에 명시한다.
4. **"바로 반영해줘" / "메인에 직접 올려줘" / "PR 없이 push"** 등 명시적 지시가 있을 때만 `main`(또는 지정 브랜치)에 직접 push한다. 이 경우에도 push 직전에 변경 파일 목록과 diff 요약을 다시 보여주고 진행한다.
5. `SESSION_SECRET`, API 키, `ALLOWED_ORIGIN` 등 배포/인증에 영향 있는 값은 사용자가 명시적으로 값을 바꾸라고 하지 않는 한 건드리지 않는다.
6. 작업이 끝나면 sandbox 내 clone은 세션 종료와 함께 사라진다는 점을 안내하고, 토큰이 커밋 메시지나 코드에 남지 않았는지 마지막에 확인한다.

## 참고

- 이 템플릿은 Project 지침이나 memory에 토큰 값 자체를 넣지 않기 위한 것이다. 템플릿(절차)만 저장/재사용하고, 토큰 값은 매 세션 사람이 직접 채워 붙여넣는다.
- 반복 작업이 잦다면 이 방식보다 Claude Code(로컬 저장소 + `gh auth login`)가 인증을 세션 간 유지해주므로 더 적합하다.
