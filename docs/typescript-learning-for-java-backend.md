# TypeScript Learning Guide for Java Backend Developers

이 문서는 Java 백엔드 개발자 관점에서 현재 StockMon TypeScript 코드를 읽기 위한 첫 학습 가이드입니다.

목표는 TypeScript 문법을 따로 외우는 것이 아니라, 이 프로젝트의 실제 코드 흐름을 따라가면서 Java/Spring 경험과 연결해 이해하는 것입니다.

## 1. 프로젝트를 Java 백엔드 관점으로 보기

현재 프로젝트는 `Express + TypeScript` 기반 백엔드입니다.

Java Spring 프로젝트와 비교하면 대략 이렇게 볼 수 있습니다.

```text
src/server.ts                  Java main(), SpringApplication.run()
src/app.ts                     Spring Boot 설정 + Filter + Controller 등록
src/routes/*.ts                Controller
src/services/*.ts              Service
src/types.ts                   DTO / domain type
src/config.ts                  application.yml / @ConfigurationProperties
src/lib/*.ts                   공통 util
public/*                       정적 프론트 리소스
```

처음부터 모든 파일을 보지 말고, 서버 시작점에서 API 하나까지 흐름을 따라가는 방식이 좋습니다.

추천 순서:

```text
1. src/server.ts
2. src/app.ts
3. src/routes/analysisRoutes.ts
4. src/types.ts
5. src/services/stockAnalysis.ts
6. src/lib/http.ts
```

## 2. 서버 진입점: server.ts

파일:

```text
src/server.ts
```

핵심 코드:

```ts
import { app } from "./app.js";
import { config } from "./config.js";
import { createLogger } from "./lib/logger.js";

const logger = createLogger("server");

app.listen(config.port, () => {
  logger.info("listening", {
    port: config.port
  });
});
```

Java Spring으로 비유하면:

```java
public static void main(String[] args) {
    SpringApplication.run(App.class, args);
}
```

여기서 볼 TypeScript 포인트:

- `import`: 다른 파일의 값을 가져온다.
- `const`: 재할당하지 않을 변수 선언이다.
- `app.listen(...)`: Express 서버를 특정 포트에서 실행한다.
- `() => { ... }`: Java의 람다와 비슷한 함수 표현식이다.

주의할 점:

이 프로젝트는 `.ts` 파일인데 import 경로에 `.js`를 씁니다.

```ts
import { app } from "./app.js";
```

이유는 `package.json`의 `"type": "module"`과 `tsconfig.json`의 `NodeNext` 설정 때문입니다. TypeScript가 JavaScript로 컴파일된 뒤 Node.js가 실행할 경로를 기준으로 적는 방식입니다.

## 3. Express 앱 구성: app.ts

파일:

```text
src/app.ts
```

이 파일은 Spring 기준으로 보면 다음 역할을 합니다.

```java
@Configuration
public class WebConfig {
    // JSON body parser 설정
    // 요청 로깅 filter 등록
    // static resource 등록
    // controller 등록
    // exception handler 등록
}
```

핵심 코드:

```ts
export const app = express();
```

뜻:

```text
Express 애플리케이션 객체를 만들고, 다른 파일에서 import할 수 있게 export한다.
```

Spring의 `ApplicationContext`나 웹 애플리케이션 설정 객체처럼 보면 됩니다.

### JSON 요청 처리

```ts
app.use(express.json());
```

Java Spring으로 치면 `@RequestBody`를 JSON으로 받을 수 있게 하는 기본 설정에 가깝습니다.

### 요청 로깅 미들웨어

```ts
app.use((request, response, next) => {
  const startedAt = Date.now();
  const requestId = request.header("x-request-id") || randomUUID().slice(0, 8);

  response.locals.requestId = requestId;
  response.setHeader("x-request-id", requestId);

  logger.info("request:start", {
    requestId,
    method: request.method,
    path: request.originalUrl,
    ip: request.ip
  });

  response.on("finish", () => {
    logger.info("request:finish", {
      requestId,
      method: request.method,
      path: request.originalUrl,
      status: response.statusCode,
      durationMs: Date.now() - startedAt
    });
  });

  next();
});
```

Java Spring으로 비유하면 `Filter`나 `HandlerInterceptor`에 가깝습니다.

중요한 포인트:

- `request`: Java의 `HttpServletRequest` 느낌
- `response`: Java의 `HttpServletResponse` 느낌
- `next()`: 다음 미들웨어 또는 라우터로 넘긴다
- `response.locals`: 요청 처리 중 공유할 값을 임시 저장하는 곳

### 라우터 등록

```ts
app.use("/analysis", analysisRoutes);
app.use("/alerts", alertRoutes);
```

Java Spring으로 치면:

```java
@RestController
@RequestMapping("/analysis")
public class AnalysisController {
}
```

즉 `/analysis`로 시작하는 요청은 `analysisRoutes`가 처리합니다.

### 에러 핸들러

```ts
app.use((error: unknown, request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";

  response.status(500).json({
    error: message,
    requestId: response.locals.requestId
  });
});
```

Java Spring으로 치면:

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(Exception.class)
    public ErrorResponse handle(Exception e) {
        ...
    }
}
```

여기서 `unknown`은 TypeScript에서 안전한 최상위 타입입니다. Java의 `Object`와 비슷하지만, 바로 속성을 꺼내 쓸 수 없어서 먼저 타입 체크가 필요합니다.

```ts
if (error instanceof Error) {
  error.message;
}
```

## 4. Controller 역할: analysisRoutes.ts

파일:

```text
src/routes/analysisRoutes.ts
```

학습 첫 API:

```http
POST /analysis/recommendations
```

실제 코드:

```ts
analysisRoutes.post("/recommendations", async (request, response, next) => {
  try {
    const input = recommendationBatchSchema.parse(request.body);
    const analyses = await analyzeRecommendations(input.items);

    logger.info("recommendations:success", {
      count: analyses.length
    });

    response.json({
      count: analyses.length,
      analyses
    });
  } catch (error) {
    logger.error("recommendations:failed", toErrorContext(error));
    next(error);
  }
});
```

이 코드는 Java Spring으로 보면 거의 다음과 같습니다.

```java
@PostMapping("/recommendations")
public RecommendationResponse recommendations(
    @Valid @RequestBody RecommendationBatchRequest input
) {
    List<Analysis> analyses = stockAnalysisService.analyzeRecommendations(input.getItems());

    return new RecommendationResponse(analyses.size(), analyses);
}
```

흐름:

```text
1. POST /analysis/recommendations 요청이 들어온다.
2. request.body를 zod schema로 검증한다.
3. service 함수인 analyzeRecommendations(...)를 호출한다.
4. 결과를 JSON으로 응답한다.
5. 에러가 나면 next(error)로 글로벌 에러 핸들러에 넘긴다.
```

여기서 배울 TypeScript/Node 포인트:

- `async`: 비동기 함수 선언
- `await`: Promise 결과를 기다림
- `request.body`: HTTP 요청 body
- `response.json(...)`: JSON 응답
- `try/catch`: 예외 처리
- `next(error)`: Express 에러 핸들러로 전달

## 5. DTO 역할: types.ts

파일:

```text
src/types.ts
```

예시 타입:

```ts
export type RecommendationRequest = {
  name?: string;
  symbol: string;
  anchorDate: string;
  latestMentionDate?: string;
  note?: string;
  category?: "longTerm" | "dividend" | "swing";
};
```

Java DTO로 보면:

```java
public class RecommendationRequest {
    private String name;
    private String symbol;
    private String anchorDate;
    private String latestMentionDate;
    private String note;
    private Category category;
}
```

### optional 필드

```ts
name?: string;
```

뜻:

```text
name은 없어도 된다. 단, 있다면 string이어야 한다.
```

Java로 치면 nullable 필드에 가깝습니다.

### union type

```ts
category?: "longTerm" | "dividend" | "swing";
```

뜻:

```text
category는 longTerm, dividend, swing 중 하나만 가능하다.
```

Java enum과 비슷합니다.

```java
enum Category {
    LONG_TERM,
    DIVIDEND,
    SWING
}
```

## 6. zod schema: 런타임 요청 검증

`analysisRoutes.ts`에는 이런 schema가 있습니다.

```ts
const recommendationSchema = z.object({
  name: z.string().min(1).optional(),
  symbol: z.string().min(1),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  latestMentionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().min(1).optional(),
  category: z.enum(["longTerm", "dividend", "swing"]).optional()
});

const recommendationBatchSchema = z.object({
  items: z.array(recommendationSchema).min(1)
});
```

Java Bean Validation으로 보면:

```java
public class RecommendationRequest {
    @NotBlank
    private String symbol;

    @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}")
    private String anchorDate;
}
```

중요한 구분:

```text
TypeScript type
-> 컴파일 타임 타입 검사
-> 실행 중에는 사라짐

zod schema
-> 런타임 데이터 검증
-> 실제 HTTP 요청 body를 검사함
```

즉 외부에서 들어오는 HTTP 요청은 TypeScript 타입만으로 안전해지지 않습니다. 그래서 zod가 필요합니다.

## 7. Service 역할: stockAnalysis.ts

파일:

```text
src/services/stockAnalysis.ts
```

컨트롤러에서 호출하는 함수:

```ts
export async function analyzeRecommendations(inputs: RecommendationRequest[]) {
  return Promise.all(inputs.map((input) => analyzeRecommendation(input)));
}
```

Java로 보면:

```java
public List<Analysis> analyzeRecommendations(List<RecommendationRequest> inputs) {
    return inputs.stream()
        .map(this::analyzeRecommendation)
        .toList();
}
```

다만 TypeScript 코드는 비동기입니다.

```ts
Promise.all(...)
```

Java 감각으로는 여러 `CompletableFuture`를 동시에 실행하고 모두 끝날 때까지 기다리는 것과 비슷합니다.

```java
CompletableFuture.allOf(...)
```

## 8. async / await 감각 잡기

TypeScript에서 비동기 함수는 보통 이렇게 씁니다.

```ts
async function getData(): Promise<Data> {
  const result = await fetchSomething();
  return result;
}
```

Java 감각:

```java
CompletableFuture<Data> getData() {
    return fetchSomething();
}
```

단, `await`를 쓰면 코드가 동기 코드처럼 읽힙니다.

```ts
const analyses = await analyzeRecommendations(input.items);
```

뜻:

```text
analyzeRecommendations가 끝날 때까지 기다린 뒤 analyses에 결과를 담는다.
```

## 9. config.ts: 환경 설정

파일:

```text
src/config.ts
```

핵심 코드:

```ts
import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 3000),
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
  alertWebhookSecret: process.env.ALERT_WEBHOOK_SECRET
};
```

Java Spring으로 보면:

```java
@ConfigurationProperties
public class AppProperties {
    private int port;
    private String discordWebhookUrl;
}
```

또는 `application.yml` / 환경변수 바인딩과 비슷합니다.

```ts
process.env.PORT
```

이건 Java의 `System.getenv("PORT")`와 비슷합니다.

```ts
process.env.PORT ?? 3000
```

`??`는 nullish coalescing 연산자입니다.

뜻:

```text
왼쪽 값이 null 또는 undefined이면 오른쪽 값을 사용한다.
```

## 10. lib/http.ts: generic 첫 예시

파일:

```text
src/lib/http.ts
```

핵심 코드:

```ts
export async function readJson<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  let payload: unknown;

  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error("Request failed to parse JSON");
  }

  if (!response.ok) {
    throw new Error("Request failed");
  }

  return payload as T;
}
```

여기서:

```ts
function readJson<T>(...): Promise<T>
```

Java generic으로 보면:

```java
public <T> T readJson(Response response, Class<T> type) {
    ...
}
```

`T`는 호출하는 쪽에서 원하는 응답 타입입니다.

예상 사용 감각:

```ts
const payload = await readJson<MyResponse>(response);
```

뜻:

```text
이 JSON 응답을 MyResponse 타입으로 다루겠다.
```

주의:

```ts
return payload as T;
```

이건 타입 단언입니다. Java의 cast와 비슷합니다.

```java
return (T) payload;
```

런타임 검증이 아니라 TypeScript 컴파일러에게 "이 타입으로 믿어라"라고 말하는 것입니다.

## 11. 첫 번째 API 전체 흐름

학습 대상:

```http
POST /analysis/recommendations
```

전체 흐름:

```text
1. src/server.ts
   서버 실행

2. src/app.ts
   Express app 생성
   JSON parser 등록
   request logger 등록
   /analysis 라우터 등록

3. src/routes/analysisRoutes.ts
   POST /recommendations 요청 처리
   request.body를 zod로 검증

4. src/services/stockAnalysis.ts
   analyzeRecommendations 호출
   각 종목 분석 수행

5. response.json(...)
   분석 결과를 JSON으로 응답

6. 에러 발생 시
   next(error)
   -> app.ts의 글로벌 에러 핸들러
```

Java Spring 흐름으로 바꾸면:

```text
main()
-> SpringApplication.run()
-> WebMvc 설정
-> Filter / Interceptor
-> @RestController
-> @Valid @RequestBody
-> Service
-> Response DTO
-> @RestControllerAdvice
```

## 12. 지금 단계에서 외울 것

처음에는 이것만 정확히 잡으면 됩니다.

```ts
const value = ...
let value = ...
```

변수 선언입니다.

```ts
type User = {
  name: string;
  age?: number;
};
```

DTO 또는 객체 타입입니다.

```ts
function add(a: number, b: number): number {
  return a + b;
}
```

함수 타입입니다.

```ts
async function getUser(): Promise<User> {
  ...
}
```

비동기 함수입니다.

```ts
const input = schema.parse(request.body);
```

외부 요청 검증입니다.

```ts
response.json(payload);
```

JSON 응답입니다.

## 13. 다음 학습 주제

다음에는 `/analysis/recommendations`를 한 줄씩 뜯어서 봅니다.

학습 순서:

```text
1. Router가 무엇인지
2. async handler가 왜 필요한지
3. request, response, next가 각각 무엇인지
4. zod parse가 실패하면 어떻게 되는지
5. await analyzeRecommendations(...)가 무엇을 기다리는지
6. response.json(...)이 Java return DTO와 어떻게 다른지
7. next(error)가 글로벌 에러 핸들러로 어떻게 이어지는지
```

