import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 3000);
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function localFallback(payload) {
  const god = payload.god || {};
  const menuCandidates = Array.isArray(payload.menuCandidates) && payload.menuCandidates.length
    ? payload.menuCandidates
    : ["김치찌개", "제육볶음", "쌀국수", "돈카츠", "비빔밥"];
  const pick = items => items[Math.floor(Math.random() * items.length)];
  const menu = pick(menuCandidates);
  const luckyColor = pick(god.luckyColors || ["노랑", "초록", "빨강"]);
  const side = pick(god.sides || ["따뜻한 차", "계란 추가", "김치"]);
  const direction = pick(["동쪽", "서쪽", "창가", "출입구에서 먼 자리"]);
  const luckyTime = pick(["11:40", "12:07", "12:26", "12:48", "13:03"]);
  const cautionTag = pick(["아무거나 금지", "과속 식사 주의", "빈속 답장 금지"]);
  const fortuneWeather = pick(["맑음 뒤 감칠맛", "금빛 상승세", "초록빛 횡재수"]);
  const concern = payload.concern && payload.concern !== "특별한 고민 없음"
    ? `네가 털어놓은 고민은 "${payload.concern}"이다. `
    : "";
  const birthFlavor = payload.birthInfo && payload.birthInfo !== "입력 안 함"
    ? `사주맛으로는 ${payload.birthInfo}의 기운이 오늘 든든한 한 그릇 쪽으로 살짝 기운다. `
    : "";

  return {
    theme: `${god.emoji || "🔮"} ${god.name || "음식의 신"} · 로컬 점심 판결`,
    menu,
    fortune: `${god.name || "음식의 신"}은 오늘 점심 이후 운이 조금씩 풀린다고 본다. ${concern}${birthFlavor}${menu}은 지금의 기운을 가장 덜 낭비하는 선택이다. 조심할 것은 애매한 메뉴와 애매한 대답이다. 맛있는 한 입 뒤에 작은 행운이 조용히 붙어 온다.`,
    luckyColor,
    side,
    direction,
    luckyTime,
    cautionTag,
    fortuneWeather,
    confidence: `${Math.floor(84 + Math.random() * 12)}%`
  };
}

async function handleFortune(req, res) {
  let payload;
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    sendJson(res, 400, { error: "Invalid JSON" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sendJson(res, 200, localFallback(payload));
    return;
  }

  const god = payload.god || {};
  const concern = payload.concern || "특별한 고민 없음";
  const birthInfo = payload.birthInfo || "입력 안 함";
  const menuCandidates = shuffle(Array.isArray(payload.menuCandidates) ? payload.menuCandidates : []);
  const omenSeed = payload.omenSeed || Math.random().toString(36).slice(2, 10);
  const prompt = [
    "너는 한국 직장인의 점심 메뉴 고민을 해결해주는 '음식의 신'이다.",
    "선택된 신의 캐릭터와 사용자가 털어놓은 고민을 섞어서 재미있지만 실제로 도움이 되는 점심 추천을 만든다.",
    "생년월일시가 있으면 정통 사주 풀이처럼 단정하지 말고, '사주맛' 정도의 가벼운 오행/기운 농담으로만 반영한다.",
    "톤은 쓸데없이 장엄하고 간지나지만, 추천 내용은 현실적이어야 한다.",
    "반드시 JSON만 반환한다. markdown 코드블록 금지.",
    "필드: theme, menu, fortune, luckyColor, side, direction, luckyTime, cautionTag, fortuneWeather, confidence.",
    "fortune은 한국어 4문장. 하루 일진, 점심 메뉴를 고른 이유, 오늘 조심할 것, 작은 예언을 각각 자연스럽게 포함한다.",
    "menu는 실제 점심 메뉴 1개. side는 곁들이면 좋은 것 1개. direction은 오늘의 방향, luckyTime은 HH:MM 형식, cautionTag는 짧은 주의 태그, fortuneWeather는 오늘 운세 날씨 같은 짧은 표현, confidence는 '88%' 형식.",
    "매번 같은 안전한 기본 메뉴로 수렴하지 마라. 특히 비빔밥, 김치찌개, 제육볶음 같은 기본 메뉴는 정말 잘 맞을 때만 선택한다.",
    "후보 목록의 앞쪽 메뉴를 우선 참고하되, 사용자의 고민과 신의 성향에 맞으면 후보 밖의 현실적인 한국 점심 메뉴도 허용한다.",
    `오늘의 무작위 계시값: ${omenSeed}`,
    `오늘 날짜: ${payload.today || "오늘"}`,
    `선택된 신: ${god.name || "음식의 신"} (${god.title || "점심 관리자"}, ${god.mood || "오늘"})`,
    `신의 말투 참고: ${(god.voices || []).join(" ")}`,
    `사용자가 털어놓은 고민: ${concern}`,
    `사주맛 참고 입력: ${birthInfo}`,
    `추천 메뉴 후보 참고: ${menuCandidates.slice(0, 80).join(", ")}`
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: prompt,
        text: { format: { type: "json_object" } }
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("OpenAI API error", response.status, detail);
      sendJson(res, 200, localFallback(payload));
      return;
    }

    const data = await response.json();
    const text = data.output_text
      || data.output?.flatMap(item => item.content || []).map(part => part.text || "").join("")
      || "";
    sendJson(res, 200, JSON.parse(text));
  } catch (error) {
    console.error("Fortune generation failed", error);
    sendJson(res, 200, localFallback(payload));
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(root, requested));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": filePath.endsWith(".html") ? "no-cache" : "public, max-age=31536000, immutable"
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/fortune") {
    await handleFortune(req, res);
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    await serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
}).listen(port, () => {
  console.log(`Food God Lunch running on :${port}`);
});
