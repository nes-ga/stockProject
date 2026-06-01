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

## 14. 1차 학습 기록: `/analysis/recommendations` 흐름

학습일: 2026-05-29

이번 학습에서는 `POST /analysis/recommendations` API를 Java/Spring 관점으로 읽었습니다.

### 14.1 최종 URL이 만들어지는 방식

`app.ts`에서 라우터가 이렇게 등록됩니다.

```ts
app.use("/analysis", analysisRoutes);
```

그리고 `analysisRoutes.ts`에서 세부 라우트가 이렇게 선언됩니다.

```ts
analysisRoutes.post("/recommendations", async (request, response, next) => {
  ...
});
```

따라서 실제 API 경로는 다음과 같습니다.

```http
POST /analysis/recommendations
```

Java Spring으로 보면 다음 구조와 비슷합니다.

```java
@RestController
@RequestMapping("/analysis")
public class AnalysisController {

    @PostMapping("/recommendations")
    public RecommendationResponse recommendations(...) {
        ...
    }
}
```

### 14.2 TypeScript optional과 zod optional

`types.ts`의 타입:

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

핵심 이해:

```text
symbol: string
-> 필수 필드
-> key가 반드시 있어야 하고 값은 string이어야 함

name?: string
-> optional 필드
-> key가 없어도 됨
-> key가 있다면 값은 string이어야 함
```

zod schema에서:

```ts
note: z.string().min(1).optional()
```

이 뜻은 다음과 같습니다.

```text
note는 없어도 된다.
하지만 note가 있다면 string이어야 하고, 빈 문자열은 안 된다.
```

주의:

```text
optional()
-> key가 없거나 undefined인 것을 허용

nullable()
-> 값이 null인 것을 허용

min(1)
-> string 값이 있을 때 길이가 최소 1이어야 함
```

따라서 `z.string().optional()`은 key가 없어도 되고, key가 있다면 문자열이면 됩니다. 이 경우 `""`도 통과합니다.

```ts
z.string().optional()
```

반면 아래는 key가 없어도 되지만, key가 있다면 빈 문자열은 실패합니다.

```ts
z.string().min(1).optional()
```

### 14.3 zod parse는 런타임 요청 검증이다

라우터의 핵심 줄:

```ts
const input = recommendationBatchSchema.parse(request.body);
```

Spring으로 치면 다음과 비슷합니다.

```java
public RecommendationResponse recommendations(
    @Valid @RequestBody RecommendationBatchRequest input
) {
    ...
}
```

중요한 구분:

```text
TypeScript type
-> 컴파일 타임 타입 검사
-> 실행 중에는 사라짐

zod schema
-> 런타임 데이터 검증
-> 실제 HTTP request body를 검사함
```

외부에서 들어오는 JSON은 TypeScript 타입만으로 안전해지지 않기 때문에 `parse(request.body)`로 검증합니다.

### 14.4 Promise, await, Promise.all 감각

라우터의 서비스 호출:

```ts
const analyses = await analyzeRecommendations(input.items);
```

서비스 함수:

```ts
export async function analyzeRecommendations(inputs: RecommendationRequest[]) {
  return Promise.all(inputs.map((input) => analyzeRecommendation(input)));
}
```

이해한 내용:

```text
Promise
-> 나중에 값이 완료될 비동기 작업 객체
-> Java의 CompletableFuture와 비슷함

await
-> Promise가 끝날 때까지 기다린 뒤 실제 값을 꺼냄

Promise.all
-> 여러 Promise를 한꺼번에 기다림
-> 전부 성공하면 결과 배열을 반환
-> 하나라도 실패하면 전체가 실패
```

Java 감각으로 보면:

```java
CompletableFuture<Integer> future = fetchPriceAsync();

// future 객체 자체
System.out.println(future);

// 실제 값
Integer price = future.join();
```

TypeScript 감각:

```ts
const promise = fetchPrice();

// Promise 객체 자체
console.log(promise);

// 실제 값
const price = await promise;
```

정리:

```text
fetchPrice
= 함수 자체

fetchPrice()
= 함수 호출 결과로 나온 Promise 객체

await fetchPrice()
= Promise가 완료된 뒤의 실제 return 값
```

현재 프로젝트 코드의 동작:

```text
1. inputs 배열을 앞에서부터 돌며 analyzeRecommendation(input)을 호출한다.
2. 각 호출은 실제 결과가 아니라 Promise를 바로 반환한다.
3. Promise.all이 모든 Promise가 끝날 때까지 기다린다.
4. 모든 분석이 끝나면 결과 배열을 반환한다.
```

주의:

```text
호출 시작 순서: item1 -> item2 -> item3
완료 순서: item2 -> item3 -> item1 가능
최종 결과 배열 순서: item1 결과 -> item2 결과 -> item3 결과
```

하나씩 순차 처리하는 코드는 다음처럼 생깁니다.

```ts
const analyses = [];

for (const input of inputs) {
  const analysis = await analyzeRecommendation(input);
  analyses.push(analysis);
}
```

하지만 현재 프로젝트는 `Promise.all(...)`을 사용하므로 여러 종목 분석을 동시에 시작하고 모두 끝날 때까지 기다립니다.

### 14.5 response.json은 JSON HTTP 응답을 보내는 Express 메서드다

라우터의 응답 코드:

```ts
response.json({
  count: analyses.length,
  analyses
});
```

Spring으로 치면 다음과 비슷합니다.

```java
return new RecommendationResponse(
    analyses.size(),
    analyses
);
```

Express의 `response.json(...)`은 다음 일을 해줍니다.

```text
1. JavaScript 객체를 JSON 문자열로 변환
2. 기본 status 200 사용
3. Content-Type을 application/json 계열로 설정
4. response body에 JSON을 씀
5. 응답을 종료
```

상태 코드를 명시하고 싶으면 다음처럼 체이닝합니다.

```ts
response.status(201).json({
  ok: true,
  analyses
});
```

객체 축약 문법:

```ts
response.json({
  analyses
});
```

위 코드는 아래와 같습니다.

```ts
response.json({
  analyses: analyses
});
```

즉 key 이름과 변수 이름이 같으면 한 번만 쓸 수 있습니다.

### 14.6 next(error)와 글로벌 에러 핸들러

라우터의 catch 블록:

```ts
} catch (error) {
  logger.error("recommendations:failed", toErrorContext(error));
  next(error);
}
```

`next(error)`는 Express에서 에러를 다음 에러 처리 미들웨어로 넘기는 역할입니다.

`app.ts`의 글로벌 에러 핸들러:

```ts
app.use((error: unknown, request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";

  response.status(500).json({
    error: message,
    requestId: response.locals.requestId
  });
});
```

Spring으로 치면 `@RestControllerAdvice`와 비슷합니다.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    public ErrorResponse handle(Exception e) {
        return new ErrorResponse(e.getMessage());
    }
}
```

에러 흐름:

```text
1. parse(request.body) 또는 service 호출 중 에러 발생
2. catch(error)로 들어감
3. logger.error(...)로 로그 남김
4. next(error) 호출
5. app.ts의 글로벌 에러 핸들러가 받음
6. response.status(500).json(...)으로 에러 응답 전송
```

중요한 점:

```text
catch에서 로그만 찍고 끝내면 클라이언트가 응답을 못 받을 수 있다.
요청이 열린 채로 남아 있다가 timeout이 날 수 있다.
```

따라서 catch에서는 둘 중 하나를 해야 합니다.

```ts
response.status(500).json({ error: "failed" });
```

또는:

```ts
next(error);
```

이 프로젝트는 라우터에서 `next(error)`로 넘기고, `app.ts`의 글로벌 에러 핸들러에서 에러 응답 형식을 통일하는 구조입니다.

### 14.7 지금까지 이해한 전체 흐름

```text
1. POST /analysis/recommendations 요청이 들어온다.
2. app.ts의 app.use("/analysis", analysisRoutes)를 통해 analysisRoutes로 간다.
3. analysisRoutes.post("/recommendations", ...) 핸들러가 실행된다.
4. recommendationBatchSchema.parse(request.body)로 요청 body를 검증한다.
5. analyzeRecommendations(input.items)를 호출한다.
6. 내부에서 Promise.all로 여러 analyzeRecommendation 작업을 동시에 시작하고 모두 기다린다.
7. 결과 배열을 analyses에 담는다.
8. response.json({ count, analyses })로 JSON 응답을 보낸다.
9. 중간에 에러가 나면 catch에서 next(error)로 글로벌 에러 핸들러에 넘긴다.
```

## 15. 다음 학습 계획

다음에는 `analyzeRecommendation(input)` 함수 내부를 읽습니다.

학습 순서:

```text
1. resolveFinanceSymbol(input.symbol, config.yahooDefaultMarketSuffix)
   - 입력 symbol을 실제 조회용 symbol로 바꾸는 흐름

2. logger.info("recommendation:analyze:start", ...)
   - 서버 로그가 어떤 목적으로 남는지

3. const period1 = addDays(input.anchorDate, -40)
   - 기준일보다 40일 전부터 차트를 가져오는 이유

4. const [chartResult, fundamentals] = await Promise.all([...])
   - 차트 데이터와 펀더멘털 데이터를 동시에 가져오는 구조

5. input.category에 따른 분기
   - swing이면 longTermReview 없음
   - dividend면 analyzeDividendCandidate
   - 그 외에는 analyzeLongTermCandidate

6. chartResult에서 quote, points를 꺼내는 구조
   - const { quote, points } = chartResult
   - 구조 분해 할당 학습

7. anchorIndex 계산
   - points.findIndex((point) => point.date >= input.anchorDate)
   - 추천 기준일 이후 첫 거래일을 찾는 로직

8. latestPoint, highestPoint, lowestPoint 계산
   - 기준일 이후 수익률, 최대 상승, 최대 하락 계산 흐름

9. 최종 analysis 객체 생성
   - Java DTO 생성과 비교

10. return analysis
   - 서비스 결과가 라우터의 analyses 배열로 돌아가는 흐름
```

다음 학습 시작 위치:

```ts
export async function analyzeRecommendation(input: RecommendationRequest): Promise<RecommendationAnalysis> {
  const symbol = resolveFinanceSymbol(input.symbol, config.yahooDefaultMarketSuffix);
  ...
}
```

## 16. 2차 학습 기록: `analyzeRecommendation(input)` 초반 흐름

학습일: 2026-06-01

이번 학습에서는 `src/services/stockAnalysis.ts`의 `analyzeRecommendation(input)` 함수 내부를 읽기 시작했습니다.

이 함수의 역할은 다음과 같습니다.

```text
RecommendationRequest 하나를 받아서
차트 데이터 + 펀더멘털 데이터 + 수익률 계산을 한 뒤
RecommendationAnalysis 하나로 만들어 반환한다.
```

Java 관점으로 보면 대략 다음과 비슷합니다.

```java
public CompletableFuture<RecommendationAnalysis> analyzeRecommendation(RecommendationRequest input) {
    ...
}
```

### 16.1 입력 symbol을 실제 조회용 symbol로 변환

첫 줄:

```ts
const symbol = resolveFinanceSymbol(input.symbol, config.yahooDefaultMarketSuffix);
```

뜻:

```text
사용자가 입력한 symbol을 실제 금융 API 조회용 symbol로 바꾼다.
```

예를 들어 한국 종목 코드를 `005930`처럼 넣으면, 실제 Yahoo/Naver 조회에는 `.KS` 같은 suffix가 필요할 수 있습니다. 그 처리를 `resolveFinanceSymbol(...)`이 담당합니다.

Java 감각:

```java
String symbol = resolveFinanceSymbol(input.getSymbol(), config.getYahooDefaultMarketSuffix());
```

여기서 `const`는 Java의 `final` 변수처럼 보면 됩니다.

```ts
const symbol = ...
```

즉 한 번 값을 정하면 다시 다른 값으로 재할당하지 않겠다는 뜻입니다.

### 16.2 분석 시작 로그

```ts
logger.info("recommendation:analyze:start", {
  symbol: input.symbol,
  resolvedSymbol: symbol,
  anchorDate: input.anchorDate
});
```

뜻:

```text
종목 분석을 시작했다는 로그를 남긴다.
입력 symbol, 실제 조회 symbol, 기준일(anchorDate)을 함께 기록한다.
```

Java/Spring 로그와 비교하면:

```java
log.info("recommendation:analyze:start symbol={}, resolvedSymbol={}, anchorDate={}",
    input.getSymbol(),
    symbol,
    input.getAnchorDate()
);
```

TypeScript 코드에서는 로그 context를 객체로 넘깁니다.

```ts
{
  symbol: input.symbol,
  resolvedSymbol: symbol,
  anchorDate: input.anchorDate
}
```

이런 형태는 JSON 로그로 남기기 좋습니다.

### 16.3 기준일보다 40일 전 날짜 계산

```ts
const period1 = addDays(input.anchorDate, -40);
```

뜻:

```text
추천 기준일보다 40일 전 날짜를 구한다.
```

예:

```text
anchorDate = 2026-05-29
period1 = 2026-04-19 근처
```

40일 전부터 차트를 가져오는 이유는 기준일 가격만 필요한 것이 아니기 때문입니다. 기준일 이전 거래량 평균이나 기준일 주변 흐름을 계산하려면 이전 데이터가 필요합니다.

Java 감각:

```java
LocalDate period1 = addDays(input.getAnchorDate(), -40);
```

### 16.4 category에 따라 차트 조회 개수 결정

```ts
const naverCount = input.category === "swing" ? DEFAULT_NAVER_CHART_SESSIONS : LONG_TERM_NAVER_CHART_SESSIONS;
```

이 코드는 삼항 연산자입니다.

```ts
조건 ? 참일 때 값 : 거짓일 때 값
```

풀어 쓰면:

```ts
let naverCount;

if (input.category === "swing") {
  naverCount = DEFAULT_NAVER_CHART_SESSIONS;
} else {
  naverCount = LONG_TERM_NAVER_CHART_SESSIONS;
}
```

Java와 비교하면:

```java
int naverCount = input.getCategory() == Category.SWING
    ? DEFAULT_NAVER_CHART_SESSIONS
    : LONG_TERM_NAVER_CHART_SESSIONS;
```

여기서 `===`는 JavaScript/TypeScript의 엄격 비교입니다. TypeScript 코드에서는 일반적으로 `==`보다 `===`를 씁니다.

### 16.5 차트 데이터와 펀더멘털 데이터를 동시에 가져오기

```ts
const [chartResult, fundamentals] = await Promise.all([
  fetchQuoteAndChart(symbol, { period1, naverCount }),
  fetchFundamentals(input.symbol)
]);
```

뜻:

```text
차트 데이터 조회와 펀더멘털 데이터 조회를 동시에 시작한다.
둘 다 끝날 때까지 기다린다.
결과를 chartResult, fundamentals에 각각 담는다.
```

Java의 `CompletableFuture` 감각으로 보면:

```java
CompletableFuture<ChartResult> chartFuture = fetchQuoteAndChart(symbol, period1, naverCount);
CompletableFuture<Fundamentals> fundamentalsFuture = fetchFundamentals(input.getSymbol());

CompletableFuture.allOf(chartFuture, fundamentalsFuture).join();

ChartResult chartResult = chartFuture.join();
Fundamentals fundamentals = fundamentalsFuture.join();
```

TypeScript에서는 이 흐름을 `Promise.all(...)`로 짧게 씁니다.

```ts
const [chartResult, fundamentals] = await Promise.all([...]);
```

여기서 `[chartResult, fundamentals]`는 배열 구조 분해 할당입니다.

풀어 쓰면:

```ts
const results = await Promise.all([...]);

const chartResult = results[0];
const fundamentals = results[1];
```

### 16.6 category별 longTermReview 분기

```ts
const longTermReview =
  input.category === "swing"
    ? undefined
    : input.category === "dividend"
      ? await analyzeDividendCandidate({
          symbol: input.symbol,
          name: input.name,
          fundamentals
        })
      : await analyzeLongTermCandidate({
          symbol: input.symbol,
          name: input.name,
          fundamentals
        });
```

삼항 연산자가 두 번 겹친 코드입니다.

풀어 쓰면:

```ts
let longTermReview;

if (input.category === "swing") {
  longTermReview = undefined;
} else if (input.category === "dividend") {
  longTermReview = await analyzeDividendCandidate({
    symbol: input.symbol,
    name: input.name,
    fundamentals
  });
} else {
  longTermReview = await analyzeLongTermCandidate({
    symbol: input.symbol,
    name: input.name,
    fundamentals
  });
}
```

Java 감각:

```java
LongTermReview longTermReview;

if (input.getCategory() == Category.SWING) {
    longTermReview = null;
} else if (input.getCategory() == Category.DIVIDEND) {
    longTermReview = analyzeDividendCandidate(input.getSymbol(), input.getName(), fundamentals);
} else {
    longTermReview = analyzeLongTermCandidate(input.getSymbol(), input.getName(), fundamentals);
}
```

핵심 의미:

```text
swing 종목
-> 장기 투자 리뷰를 하지 않는다.
-> longTermReview는 undefined

dividend 종목
-> 배당 후보 분석을 한다.

그 외
-> 장기 투자 후보 분석을 한다.
```

여기서 `undefined`는 Java의 `null`처럼 "값이 없다"는 의미로 이해하면 됩니다. 다만 TypeScript에서는 `null`과 `undefined`를 구분합니다.

### 16.7 chartResult에서 quote와 points 꺼내기

```ts
const { quote, points } = chartResult;
```

이건 객체 구조 분해 할당입니다.

만약 `chartResult`가 다음처럼 생겼다면:

```ts
const chartResult = {
  quote: {...},
  points: [...]
};
```

아래 두 줄을:

```ts
const quote = chartResult.quote;
const points = chartResult.points;
```

이렇게 짧게 쓴 것입니다.

```ts
const { quote, points } = chartResult;
```

Java로 치면 getter로 꺼내는 느낌입니다.

```java
Quote quote = chartResult.getQuote();
List<Point> points = chartResult.getPoints();
```

여기서 `points`는 차트의 일자별 가격 배열입니다.

```ts
[
  { date: "2026-05-01", close: 10000, volume: 120000 },
  { date: "2026-05-02", close: 10300, volume: 150000 }
]
```

### 16.8 fundamentals에 배당수익률 정보 보강

```ts
const enrichedFundamentals = enrichFundamentalsWithDividendYields(fundamentals, points);
```

뜻:

```text
기존 fundamentals 데이터에 차트 가격 정보를 이용해 배당수익률 같은 값을 보강한다.
```

배당수익률은 보통 다음 계산이 필요합니다.

```text
배당수익률 = 주당 배당금 / 현재 주가
```

즉 펀더멘털 데이터만으로는 부족하고, 최근 주가 데이터인 `points`가 필요합니다.

### 16.9 차트 데이터가 없으면 에러

```ts
if (!points.length) {
  throw new Error(`No chart data available for ${symbol}`);
}
```

뜻:

```text
차트 데이터가 하나도 없으면 더 이상 분석할 수 없으니 에러를 던진다.
```

`points.length`는 배열 길이입니다.

```ts
points.length
```

배열이 비어 있으면:

```ts
points.length === 0
```

`!points.length`는 `points.length`가 0일 때 `true`가 됩니다.

Java 감각:

```java
if (points.isEmpty()) {
    throw new RuntimeException("No chart data available for " + symbol);
}
```

여기서 `throw`된 에러는 라우터의 `catch`로 올라가고, 최종적으로 `next(error)`를 통해 글로벌 에러 핸들러로 전달됩니다.

```text
analyzeRecommendation에서 throw
-> analyzeRecommendations의 Promise 실패
-> 라우터 catch
-> next(error)
-> 글로벌 에러 핸들러
```

## 17. 2차 학습 기록: 기준 거래일과 거래량 배열

### 17.1 추천 기준일 이후 첫 거래일 찾기

```ts
const anchorIndex = points.findIndex((point) => point.date >= input.anchorDate);
if (anchorIndex === -1) {
  throw new Error(`No trading session found on or after ${input.anchorDate} for ${symbol}`);
}
```

`anchorIndex`의 의미:

```text
추천 기준일(anchorDate) 당일 또는 그 이후의 첫 거래일 위치
```

예를 들어 `anchorDate`가 `2026-05-04`인데 그날이 휴장일이면, 실제 차트에는 그 날짜가 없을 수 있습니다.

```ts
const points = [
  { date: "2026-05-01", close: 100 },
  { date: "2026-05-05", close: 105 },
  { date: "2026-05-06", close: 108 }
];
```

이때:

```ts
input.anchorDate = "2026-05-04";
```

첫 번째로 `point.date >= "2026-05-04"`를 만족하는 데이터는 다음입니다.

```ts
{ date: "2026-05-05", close: 105 }
```

그래서 `anchorIndex`는 `1`입니다.

Java로 보면:

```java
int anchorIndex = -1;

for (int i = 0; i < points.size(); i++) {
    if (points.get(i).getDate().compareTo(input.getAnchorDate()) >= 0) {
        anchorIndex = i;
        break;
    }
}

if (anchorIndex == -1) {
    throw new RuntimeException("No trading session found...");
}
```

TypeScript에서는 이 흐름을 `findIndex`로 짧게 씁니다.

```ts
points.findIndex((point) => point.date >= input.anchorDate)
```

`findIndex`는 조건을 만족하는 첫 번째 배열 index를 반환합니다. 없으면 `-1`을 반환합니다.

### 17.2 기준 거래일 데이터와 최신 거래일 데이터

```ts
const anchorPoint = points[anchorIndex];
```

뜻:

```text
수익률 계산의 기준이 되는 거래일 데이터
```

즉 추천 기준일 이후 첫 실제 거래일입니다.

```ts
const anchorPoint = { date: "2026-05-05", close: 105 };
```

이후 수익률 계산은 이 가격을 기준으로 합니다.

```text
기준 가격 = anchorPoint.close
```

다음은 최신 거래일입니다.

```ts
const latestPoint = points.at(-1);
if (!latestPoint) {
  throw new Error(`No latest chart point available for ${symbol}`);
}
```

`points.at(-1)`은 배열의 마지막 요소를 꺼냅니다.

```ts
const points = [
  { date: "2026-05-01", close: 100 },
  { date: "2026-05-05", close: 105 },
  { date: "2026-05-06", close: 108 }
];

const latestPoint = points.at(-1);
```

결과:

```ts
{ date: "2026-05-06", close: 108 }
```

Java로 치면:

```java
Point latestPoint = points.get(points.size() - 1);
```

위에서 이미 `points.length`를 검사했기 때문에 보통 `latestPoint`가 없을 일은 거의 없습니다. 그래도 TypeScript에서는 `points.at(-1)` 결과가 `Point | undefined`일 수 있으므로 한 번 더 확인합니다.

### 17.3 기준일 이후 데이터만 자르기

```ts
const afterAnchorPoints = points.slice(anchorIndex);
```

뜻:

```text
기준 거래일부터 마지막 거래일까지의 차트 데이터만 잘라낸다.
```

예:

```ts
const points = [
  { date: "2026-05-01", close: 100 },
  { date: "2026-05-05", close: 105 },
  { date: "2026-05-06", close: 108 },
  { date: "2026-05-07", close: 102 }
];

const anchorIndex = 1;
const afterAnchorPoints = points.slice(anchorIndex);
```

결과:

```ts
[
  { date: "2026-05-05", close: 105 },
  { date: "2026-05-06", close: 108 },
  { date: "2026-05-07", close: 102 }
]
```

Java로 치면:

```java
List<Point> afterAnchorPoints = points.subList(anchorIndex, points.size());
```

### 17.4 거래량 계산용 배열 만들기

```ts
const volumesBeforeAnchor = points.slice(Math.max(0, anchorIndex - 20), anchorIndex).map((point) => point.volume);
const volumesAfterAnchor = afterAnchorPoints.slice(0, 20).map((point) => point.volume);
const volumesLatest = points.slice(-20).map((point) => point.volume);
```

첫 번째 줄:

```ts
points.slice(Math.max(0, anchorIndex - 20), anchorIndex)
```

뜻:

```text
기준일 직전 최대 20개 거래일
```

뒤의 `map`:

```ts
.map((point) => point.volume)
```

뜻:

```text
각 point 객체에서 volume만 꺼내 배열로 만든다.
```

예:

```ts
[
  { date: "2026-05-01", close: 100, volume: 1000 },
  { date: "2026-05-02", close: 101, volume: 1200 }
].map((point) => point.volume)
```

결과:

```ts
[1000, 1200]
```

세 배열의 의미:

```text
volumesBeforeAnchor
-> 기준일 이전 20거래일 거래량

volumesAfterAnchor
-> 기준일 이후 첫 20거래일 거래량

volumesLatest
-> 가장 최근 20거래일 거래량
```

Java stream으로 보면:

```java
List<Integer> volumesLatest = points.subList(points.size() - 20, points.size())
    .stream()
    .map(Point::getVolume)
    .toList();
```

다만 실제 Java에서는 index가 0보다 작지 않게 더 조심해야 합니다. TypeScript의 `slice(-20)`은 배열 끝에서 20개를 가져오고, 데이터가 20개보다 적으면 있는 만큼만 가져옵니다.

### 17.5 오늘까지 이해한 흐름

```text
1. 입력 symbol을 실제 조회용 symbol로 변환한다.
2. 분석 시작 로그를 남긴다.
3. 기준일보다 40일 전 날짜를 계산한다.
4. category가 swing인지 longTerm/dividend인지에 따라 차트 조회 개수를 정한다.
5. 차트 데이터와 펀더멘털 데이터를 Promise.all로 동시에 가져온다.
6. category에 따라 longTermReview를 만들거나 생략한다.
7. chartResult에서 quote와 points를 꺼낸다.
8. fundamentals에 배당수익률 정보를 보강한다.
9. 차트 데이터가 없으면 에러를 던진다.
10. 추천 기준일 이후 첫 실제 거래일을 찾는다.
11. 그 거래일을 수익률 계산의 기준점(anchorPoint)으로 잡는다.
12. 차트의 마지막 거래일을 latestPoint로 잡는다.
13. 기준일 이후 데이터만 afterAnchorPoints로 자른다.
14. 기준 전/후/최근 20일 거래량 배열을 만든다.
```

다음 학습 시작 위치:

```ts
let highestPoint = anchorPoint;
let lowestPoint = anchorPoint;
for (const point of afterAnchorPoints) {
  if (point.close > highestPoint.close) {
    highestPoint = point;
  }
  if (point.close < lowestPoint.close) {
    lowestPoint = point;
  }
}
```

다음에는 기준일 이후 최고 종가와 최저 종가를 찾고, 이를 이용해 `maxGainPercent`, `maxDrawdownPercent`를 계산하는 흐름을 봅니다.
