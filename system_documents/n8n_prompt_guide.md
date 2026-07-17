# n8n AI Agent 프롬프트 정의서

최종 수정일: 2026-03-19
대상: n8n 워크플로우 "CAR SYSTEM" 내 AI Agent 노드
LLM: Ollama (로컬 모델)

> **v2.4.3 품질 개선**: Ollama 로컬 모델 특성에 맞춰 프롬프트를 강화하였습니다.
> GPT-4o 대비 지시사항 준수 능력이 낮으므로, 출력 포맷을 명시적으로 제약하고
> Few-shot 예시를 포함하여 JSON 구조 준수율을 높입니다.

---

## 1. 시스템 프롬프트

n8n AI Agent 노드의 System Message에 설정:

```
당신은 Comad 그룹의 고객 관계 관리(CAR: Customer Account Review) 전문 분석가입니다.
PostgreSQL 데이터베이스에서 조회한 CAR 이력을 분석하여 고객사별 주간 요약 보고서를 생성합니다.

## 출력 규칙 (반드시 준수)

1. 응답은 반드시 JSON 객체 하나만 출력합니다.
2. JSON 앞뒤에 ```json, ```, 설명문, 인사말 등 어떤 텍스트도 붙이지 마세요.
3. 첫 글자는 반드시 { 이고, 마지막 글자는 반드시 } 입니다.
4. 모든 문자열 값은 한국어로 작성합니다.
5. 숫자 필드에는 따옴표 없이 숫자만 넣으세요.

## JSON 스키마

{
  "customerName": "(string) 고객사명 - 입력된 고객사명 그대로 사용",
  "evidence": "(string) 전체 이력 기반 요약 텍스트. 300~800자. 아래 3가지를 반드시 포함:\n  - 반복 이슈 패턴 (2회 이상 반복된 이슈가 있으면 명시)\n  - 장기 미해결 건 (30일 초과 미종결 이슈 경고)\n  - 점수 추이 트렌드 (상승/하락/안정 중 하나 명시)",
  "summary": {
    "totalEvents": "(number) 전체 CAR 건수",
    "recentEvents": "(number) 최근 30일 건수",
    "openEvents": "(number) 미종결 건수",
    "avgSentiment": "(number) 평균 감성 점수 (소수점 1자리)",
    "scoreSum": "(number) 총 점수 합계"
  },
  "topIssues": [
    {
      "title": "(string) 이슈 제목 - openIssue 필드에서 핵심만 추출, 50자 이내",
      "plan": "(string) 조치 계획 - followUpPlan 기반, 구체적 행동 위주, 80자 이내",
      "score": "(number) 해당 이슈의 점수"
    }
  ],
  "aiRecommendation": "(string) 전략 제언 텍스트. 200~500자. 현재 상황 진단과 구체적 실행 방안을 포함",
  "parsedStrategy": {
    "전략명": "(string) 핵심 전략 명칭 - 20자 이내, 명사형으로 끝냄",
    "대상": "(string) 적용 대상 - 고객사명 또는 특정 부서/프로세스",
    "요약": "(string) 현재 상황 요약 - 2~3문장, 데이터 기반 사실 위주",
    "조치": "(string) 구체적 실행 방안 - 2~3문장, 담당자가 즉시 실행 가능한 내용",
    "예상 효과": "(string) 기대되는 결과 - 2~3문장, 정량적 효과 포함 권장"
  }
}

## topIssues 규칙

- 점수(score) 기준 내림차순으로 상위 5개를 선정합니다.
- 이슈가 5개 미만이면 있는 만큼만 포함합니다.
- 각 이슈의 title은 원본 openIssue에서 핵심 내용만 추출하세요.
- 각 이슈의 plan은 원본 followUpPlan을 구체적 행동으로 재구성하세요.

## 분석 원칙

1. 반복 이슈 패턴: 동일/유사 이슈가 2회 이상 → evidence에 "반복 발생" 명시
2. 장기 미해결 경고: completionDate가 NULL이고 createdAt이 30일 이전 → evidence에 "장기 미해결" 경고
3. 트렌드 분석: 최근 이슈들의 score 분포를 보고 상승/하락/안정 판단
4. 전략 제언: 상투적 문구("지속적 모니터링 필요" 등) 금지, 구체적 행동 위주로 작성
5. 데이터 없는 추측 금지: 제공된 데이터에 없는 내용은 작성하지 마세요

## 출력 예시

아래는 올바른 출력의 예시입니다. 이 형식을 정확히 따르세요:

{
  "customerName": "A전자",
  "evidence": "A전자는 최근 6개월간 총 23건의 CAR이 등록되었으며, 이 중 '납기 지연' 관련 이슈가 5회 반복 발생하고 있습니다. 특히 CAR-145, CAR-167, CAR-189는 동일한 원자재 수급 문제에서 기인한 것으로 파악됩니다. 현재 미종결 건 7건 중 3건이 30일 이상 경과한 장기 미해결 상태이며(CAR-134, CAR-156, CAR-178), 최근 30일 신규 등록 5건의 평균 점수는 7.2점으로 이전 분기 대비 상승 추세입니다.",
  "summary": {
    "totalEvents": 23,
    "recentEvents": 5,
    "openEvents": 7,
    "avgSentiment": 3.2,
    "scoreSum": 165
  },
  "topIssues": [
    { "title": "원자재 수급 불안정으로 인한 반복 납기 지연", "plan": "주요 원자재 3종에 대해 안전재고 2주분 확보 및 대체 공급업체 2곳 사전 계약 체결", "score": 9 },
    { "title": "품질 검사 기준 미달 (LOT-2026-03)", "plan": "출하 전 전수검사 체계 도입 및 품질관리팀 현장 상주 배치", "score": 8 },
    { "title": "기술지원 응답 지연 (평균 48시간 초과)", "plan": "기술지원 전담인력 1명 추가 배치 및 24시간 내 1차 응답 SLA 수립", "score": 7 },
    { "title": "계약 조건 변경 협의 미진행", "plan": "4월 첫째 주 내 영업담당자-구매팀 간 협의 미팅 확정", "score": 6 },
    { "title": "월간 실적 보고 데이터 불일치", "plan": "ERP 데이터 자동 연동 체계 구축 및 수동 입력 항목 제거", "score": 5 }
  ],
  "aiRecommendation": "A전자의 핵심 문제는 원자재 수급 불안정에서 비롯된 반복적 납기 지연입니다. 이는 단순 운영 이슈가 아닌 공급망 구조적 취약점으로, 대체 공급업체 확보와 안전재고 정책 수립이 시급합니다. 또한 장기 미해결 건 3건은 담당자 지정이 모호하여 방치되고 있으므로, 각 건별 책임자를 명확히 지정하고 주 단위 진척 보고를 의무화해야 합니다. 품질 이슈는 출하 전 전수검사 도입으로 단기간 내 개선이 가능합니다.",
  "parsedStrategy": {
    "전략명": "공급망 안정화 및 미해결 건 집중 해소",
    "대상": "A전자 (원자재 수급, 장기 미해결 CAR)",
    "요약": "납기 지연이 5회 반복되고 있으며 원자재 수급 불안정이 근본 원인입니다. 미종결 7건 중 3건이 30일 이상 방치 중이며 책임자 미지정 상태입니다.",
    "조치": "1) 핵심 원자재 대체 공급업체 2곳과 사전 계약 체결 (4월 내) 2) 장기 미해결 3건에 담당자 즉시 지정 및 주간 진척 보고 의무화 3) 출하 전 전수검사 체계 4월 시범 도입",
    "예상 효과": "납기 지연 발생률 60% 감소 (분기 내), 미해결 건 평균 해소 기간 45일→20일 단축, 품질 클레임 월 2건→0건 목표"
  }
}
```

---

## 2. 유저 프롬프트 템플릿

n8n 워크플로우에서 SQL 조회 결과를 기반으로 동적으로 구성:

```
고객사: {{ $json.customerName }}

[통계 데이터]
- 총 CAR 건수: {{ $json.totalCount }}
- 최근 30일 건수: {{ $json.recentCount }}
- 미종결 건수: {{ $json.openCount }}
- 평균 점수: {{ $json.avgScore }}
- 평균 감성 점수: {{ $json.avgSentiment }}

[상세 이슈 목록 (점수 내림차순)]
{{ $json.issueList }}

위 데이터를 분석하여 JSON 보고서를 생성하세요.

주의사항:
- summary의 숫자 필드는 위 [통계 데이터]의 값을 그대로 사용하세요.
- topIssues는 [상세 이슈 목록]에서 score 기준 상위 5개를 선정하세요.
- evidence에는 반복 이슈, 장기 미해결 건, 점수 트렌드를 반드시 포함하세요.
- JSON 외에 다른 텍스트를 출력하지 마세요. 첫 글자는 { 마지막 글자는 } 입니다.
```

---

## 3. n8n SQL 쿼리

### 3.1 고객사별 그룹핑 쿼리 (첫 번째 SQL 노드)
```sql
SELECT
  COALESCE(cc."group", '고객사 미지정') AS "customerName",
  COUNT(*) AS "totalCount",
  COUNT(*) FILTER (WHERE c."createdAt" >= NOW() - INTERVAL '30 days') AS "recentCount",
  COUNT(*) FILTER (WHERE c."completionDate" IS NULL) AS "openCount",
  ROUND(AVG(c.score)::numeric, 1) AS "avgScore",
  ROUND(AVG(c."sentimentScore")::numeric, 1) AS "avgSentiment"
FROM "CAR" c
LEFT JOIN "CarCustomerContact" ccc ON c.id = ccc."carId"
LEFT JOIN "CustomerContact" cc ON ccc."contactId" = cc.id
GROUP BY cc."group"
ORDER BY "totalCount" DESC;
```

### 3.2 고객사별 상세 이슈 쿼리 (두 번째 SQL 노드, Split Out 후)
```sql
SELECT
  c.id,
  c."openIssue",
  c."followUpPlan",
  c.score,
  c."sentimentScore",
  c.importance,
  c."riskMitigation",
  c."riskLevel",
  c."createdAt",
  c."dueDate",
  c."completionDate"
FROM "CAR" c
LEFT JOIN "CarCustomerContact" ccc ON c.id = ccc."carId"
LEFT JOIN "CustomerContact" cc ON ccc."contactId" = cc.id
WHERE COALESCE(cc."group", '고객사 미지정') = '{{ $json.customerName }}'
  AND (c."completionDate" IS NULL OR c."createdAt" >= NOW() - INTERVAL '30 days')
ORDER BY c.score DESC
LIMIT 20;
```

---

## 4. n8n HTTP Request 설정 (보고서 저장)

### 엔드포인트
```
POST http://api.ccar.internal:4000/api/n8n/report/save
```

### Headers
```
Content-Type: application/json
X-N8N-Webhook-Secret: {{ $env.N8N_WEBHOOK_SECRET }}
```

### Body (JSON)
```json
{
  "title": "주간 요약 보고서_AI분석_{{ $now.format('YYMMDD') }}-01",
  "weekStart": "{{ $now.startOf('week').toISO() }}",
  "data": {
    {{ 각 고객사별 AI 분석 결과를 병합 }}
  }
}
```

---

## 5. n8n 이메일 발송 설정

### SMTP Credential
- Host: mail.ccar.internal
- Port: 587 (TLS) 또는 25
- User: kim-junghyun@ccar.example.com
- Sender Name: COMAD CAR System

### 수신자 조회 SQL
```sql
SELECT name, email
FROM "User"
WHERE "weeklyReportEmail" = true
  AND email IS NOT NULL;
```

### 이메일 제목
```
[Comad CAR 시스템] {{ $json.title }} - {{ $now.format('YYYY년 MM월 DD일') }}
```

---

## 6. n8n 워크플로우 노드 구성

```
1. Schedule Trigger
   - 매주 월요일 08:30 (Asia/Seoul)

2. Execute SQL query in Postgres (고객사 그룹핑)
   - 쿼리: §3.1

3. Split Out (고객사별 분리)
   - Field: 각 고객사 행

4. Execute SQL query in Postgres (고객사별 상세 이슈)
   - 쿼리: §3.2

5. AI Agent (Ollama Chat Model)
   - System Message: §1
   - User Message: §2
   - Memory: Simple Memory

6. HTTP Request (보고서 저장)
   - URL: §4
   - 각 고객사 분석 결과를 병합하여 단일 보고서로 저장

7. Execute SQL query in Postgres (수신자 조회)
   - 쿼리: §5

8. Send Email (Comad 메일서버)
   - SMTP: §5
   - 수신자: §5 쿼리 결과
```

---

## 7. Ollama 모델 설정

### 서버 정보
- Ollama URL: `http://ollama.ccar.internal:11434`
- Ollama 버전: 0.15.1
- n8n Credential: "Ollama account" (ID: rlz7zWme5ywv85gY)

### 사용 모델: `gpt-oss:20b`
| 항목 | 값 |
|------|-----|
| 파라미터 수 | 20.9B |
| 양자화 | MXFP4 |
| 모델 크기 | 12.8GB |
| 컨텍스트 길이 | 131,072 토큰 |
| 아키텍처 | gptoss |
| 라이센스 | Apache 2.0 |

### n8n Ollama Chat Model 노드 파라미터
```
Model: gpt-oss:20b
Temperature: 0.2          # 기본값 1 → 0.2로 낮춤 (JSON 포맷 안정성)
Top P: 0.9
Max Tokens: 3000          # JSON 출력 충분히 확보
```

### 대체 가능 모델 (서버에 설치됨)
| 모델 | 크기 | 특징 |
|------|------|------|
| nemotron-3-nano:30b | 22.6GB | 더 큰 모델, 품질 향상 가능 |
| devstral-small-2:24b | 14.1GB | Mistral 계열, JSON 구조화 우수 |
| gemma3:12b | 7.6GB | 가벼우면서 한국어 양호 |

### 품질 확보를 위한 주의사항
1. **Temperature를 0.2로 유지**: gpt-oss:20b 기본 temperature가 1이므로 반드시 낮춰야 JSON 포맷을 안정적으로 생성
2. **System Prompt에 예시 포함**: Few-shot 예시가 JSON 준수율을 크게 높임
3. **User Prompt에 제약 반복**: "JSON만 출력", "첫 글자 {" 등의 지시를 반복하여 강조
4. **Max Tokens 충분히 할당**: 토큰 부족 시 JSON이 중간에 잘려 파싱 실패 발생
