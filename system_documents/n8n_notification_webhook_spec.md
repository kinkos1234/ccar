# n8n 알림 이메일 웹훅 규격 (v2.5)

CAR 시스템(v2.5)이 담당자 알림 이메일을 발송하기 위해 n8n 워크플로우로 outbound webhook을 호출합니다.
운영팀은 아래 규격에 맞춰 n8n 워크플로우(Webhook 노드 → SMTP 노드)를 구성해주시면 됩니다.

## 엔드포인트

- `.env`의 `N8N_NOTIFICATION_WEBHOOK_URL`에 n8n Webhook 노드의 Production URL을 지정합니다.
- 예: `http://n8n.ccar.internal:5678/webhook/car-notification`

## 요청

- **Method**: `POST`
- **Content-Type**: `application/json`
- **인증 헤더**: `X-N8N-Webhook-Secret: <N8N_WEBHOOK_SECRET>` (기존 인바운드 규격과 동일 값 재사용)

## 요청 바디 스키마

```json
{
  "notificationId": 12345,
  "type": "RISK_ALERT | DUE_DATE_APPROACHING | OVERDUE | ASSIGNED | RISK_LEVEL_UP",
  "title": "기한일 1일 전입니다",
  "message": "COMAD / 불량 클레임 건 (기한: 2026-04-20)",
  "recipient": {
    "userId": 42,
    "name": "홍길동",
    "email": "hong@ccar.example.com",
    "language": "ko"
  },
  "car": {
    "id": 987,
    "corporation": "COMAD",
    "openIssue": "불량 클레임 건",
    "url": "http://localhost:41000/car/987"
  },
  "createdAt": "2026-04-19T09:00:00.000+09:00"
}
```

- `recipient.language`는 `ko | en | zh | vi | hi | es-mx` 중 하나. n8n 워크플로우 내 템플릿 선택에 사용 권장.
- `car`는 시스템 공지 등 특정 안건과 무관한 경우 `null`일 수 있음.

## n8n 권장 워크플로우

1. **Webhook 노드** — 위 URL/Secret 검증
2. **Switch 노드** — `type`별 분기 (이메일 제목/템플릿 분기)
3. **Code 노드** — 언어별 다국어 처리 (선택)
4. **SMTP 노드** — `recipient.email`로 발송
   - 발신: `.env`의 `MAIL_SENDER` 사용 권장
   - 본문에 `car.url` 링크 포함하여 바로 이동 가능하도록
5. **HTTP Response 노드** — `200 OK`

## CAR 시스템 측 동작

- Webhook 응답이 `2xx`이면 해당 `Notification` 레코드에 `emailSent=true`, `emailSentAt=now()` 저장
- 비정상 응답이면 에러 로그만 남기고 인앱 알림은 정상 동작 유지 (이메일 실패가 알림 자체를 막지 않음)
- `N8N_NOTIFICATION_WEBHOOK_URL`이 비어있으면 이메일 전송을 시도하지 않음 (인앱 알림만 동작)

## 트리거 시점

| 타입 | 트리거 |
| --- | --- |
| `ASSIGNED` | CAR 신규 생성/수정 시 담당자 신규 할당 (본인 제외) |
| `RISK_LEVEL_UP` | `riskLevel`이 `HIGH` 또는 `CRITICAL`로 상향 조정 |
| `DUE_DATE_APPROACHING` | 스케줄러가 매일 9시에 `dueDate` D-3/D-1/D-day 감지 |
| `OVERDUE` | 스케줄러가 기한일을 지난 안건 감지 |
| `RISK_ALERT` | (예약) — 추후 자동 리스크 판정 훅에서 사용 |
