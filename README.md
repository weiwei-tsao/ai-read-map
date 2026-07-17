# AI Read Map

Turn long webpages into a clickable reading map, then jump straight back to the original paragraph that matters.

中文简介：AI Read Map 是一个 Chrome 扩展，把长网页变成可点击的阅读地图，帮你快速找到值得读的段落。

## What It Does

AI Read Map is a reading navigator, not just another summary box.

Open a long article, documentation page, policy page, or blog post, then generate a compact map with:

- A short page overview
- 2 to 5 key sections
- A quick preview of what each section contains
- Jump links back to the original page
- A page quality state when the content is weak or hard to read

中文说明：它不是替你读完全文，而是帮你先看清路线，再跳到原文里最有价值的位置。

## How It Works

```text
Chrome extension
  -> extracts readable page content
  -> assigns local paragraph IDs
  -> sends structured content to the backend

Backend
  -> checks the cache
  -> asks Anthropic for a structured read map
  -> validates target IDs
  -> returns safe, clickable results

Side panel
  -> renders the map
  -> jumps back to the matching paragraph
  -> highlights the original text
```

中文说明：扩展负责抓取和跳转，后端负责生成阅读地图，shared 包负责类型和结果校验。

## Project Layout

```text
shared/     Shared TypeScript types and read-map validation
backend/    Express API server, Anthropic client, in-memory cache
extension/  Chrome MV3 extension, content extraction, side panel UI
docs/       Product notes, plans, and agent/project documentation
```

中文说明：这是一个 npm workspaces monorepo，三个主要包分别处理共享类型、后端 API 和浏览器扩展。

## Tech Stack

- TypeScript
- npm workspaces
- Chrome Extension Manifest V3
- Vite + @crxjs
- Express
- Anthropic SDK
- Vitest

中文说明：整体是轻量 TypeScript 项目，适合快速开发和验证 MVP。

## Getting Started

Install dependencies:

```bash
npm install
```

Create `backend/.env`:

```bash
ANTHROPIC_API_KEY=your_api_key_here
PORT=8787
```

Run the backend:

```bash
npm run dev:backend
```

Run the extension dev server:

```bash
npm run dev:extension
```

Build the extension:

```bash
npm run build:extension
```

Then load the built extension in Chrome:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select the extension build output from `extension/dist`

中文说明：先启动后端，再构建或运行扩展。扩展会请求本地后端 `http://localhost:8787/api/readmap`。

## Useful Commands

```bash
npm run dev:backend        # Start the API server with tsx watch
npm run dev:extension      # Start Vite for the Chrome extension
npm run build:extension    # Build the extension
npm test                   # Run shared, extension, and backend tests
```

Per-workspace checks:

```bash
npm run typecheck -w backend
npm run typecheck -w extension
npm run test -w shared
npm run test -w extension
npm run test -w backend
```

中文说明：日常开发最常用的是 `dev:backend`、`dev:extension` 和 `npm test`。

## API

The backend exposes:

```text
GET  /health
POST /api/readmap
```

`POST /api/readmap` accepts structured page content:

```ts
{
  title: string
  url: string
  domain: string
  sections: {
    id: string
    heading: string | null
    paragraphs: { id: string; text: string }[]
  }[]
}
```

It returns a validated read map with `overview`, `keySections`, `pageQuality`, and a status of `ok`, `not_suitable`, or `low_confidence`.

中文说明：后端只处理结构化网页内容，并且会校验 AI 返回的跳转目标是否真实存在。

## Product Boundaries

AI Read Map stays grounded in the current page.

It should:

- Use only the extracted page content
- Keep labels short and neutral
- Link each key section back to the source text
- Avoid advice, speculation, or outside facts
- Show low-confidence states instead of forcing weak results

中文说明：它的角色是阅读导航，不是法律、医疗、金融或人生建议工具。

## Status

This is an MVP for testing one core idea:

Can a clickable reading map make long webpages easier to skim, judge, and read in context?

中文说明：当前重点是验证体验：快速理解网页，并能一键回到原文。
