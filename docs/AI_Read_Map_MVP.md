# AI Read Map Chrome Extension MVP

## 1. Overview

AI Read Map is a Chrome extension that helps users quickly understand long webpages and jump directly to the parts worth reading.

Instead of replacing the original page with a summary, the extension creates a clickable reading map for the current page.

The MVP focuses on validating one core experience:

> Extract readable page content, generate a concise read map, and let users jump back to the original paragraphs.

A Bring Your Own Key (BYOK) mode is planned as a fast-follow to support power users and reduce AI provider cost, but it should not block the first private test.

## 2. Product Motivation

Many webpages are too long to read from beginning to end.

Users often open an article, blog post, documentation page, policy page, product page, or long help page and quickly feel:

- This is too long.
- I do not know where the useful part is.
- I want the main idea first.
- I want to jump to the section that matters.
- I may read carefully only after I know which part is important.

The product should help users skim smarter, not replace reading entirely.

## 3. Core User Problem

The main problem is not simply:

```text
I need a summary.
```

The deeper problem is:

```text
I need to know which parts of this long page are worth reading.
```

A normal AI summary can tell users what the page says, but it often disconnects the summary from the original source.

AI Read Map should solve this by linking each key point back to the original paragraph or section.

## 4. Product Positioning

AI Read Map is an AI-powered reading navigator for long webpages.

It helps users:

- Understand the page quickly
- Identify important sections
- Jump to the original paragraph
- Continue reading in context
- Avoid wasting time on low-value sections

One-line description:

```text
Turn long webpages into a clickable map of key sections, so you can jump straight to what matters.
```

## 5. MVP Goal

The MVP goal is to validate whether users find value in a reading assistant that identifies important parts of a long webpage and lets them jump directly to the original content.

The MVP should answer these questions:

- Can the extension reliably extract readable page content?
- Can the extension map extracted content back to original DOM nodes?
- Can AI identify useful sections from the page?
- Do users prefer clickable key sections over a plain summary?
- Does jump-to-paragraph improve the reading experience?
- Is this useful across article-like webpages?

## 6. Target Users

Initial target users are people who frequently read long webpages and want to save time.

Primary users:

- Knowledge workers
- Software developers
- Product managers
- Students
- Researchers
- News readers
- People reading policy, government, finance, or technical pages
- Users who skim first and read carefully later

## 7. Initial Page Scope

The MVP should focus on article-like pages with readable text content.

Good initial page types:

```text
News articles
Blog posts
Technical documentation
GitHub README pages
Product announcement pages
Policy pages
Government information pages
Long help articles
```

The MVP should work best on pages with clear paragraphs or headings.

The product does not need to work perfectly on every webpage in the first version.

## 8. Core MVP User Flow

```text
User opens a long webpage
→ User clicks the Chrome extension icon
→ Extension extracts page title, headings, and paragraphs
→ Extension assigns stable IDs to paragraphs or sections
→ Extension sends structured page text to backend
→ Backend generates a structured read map
→ Extension validates returned target IDs
→ Extension shows the read map in a side panel
→ User clicks a key section
→ Page scrolls to the original paragraph
→ The relevant paragraph is temporarily highlighted
```

## 9. MVP Feature Scope

### 9.1 Manual Trigger

The extension should only run when the user clicks the extension.

Expected behavior:

```text
User clicks extension
→ Generate read map
```

The extension should not automatically process every webpage in the background.

### 9.2 Page Content Extraction

The extension should extract structured readable content from the current page.

Required extracted data:

```text
Page title
URL
Domain
Headings
Paragraphs
Paragraph order
Visible text content
```

Each paragraph or section should receive a stable local ID.

Example:

```json
{
  "pageTitle": "Example Article",
  "url": "https://example.com/article",
  "sections": [
    {
      "id": "section-1",
      "heading": "Introduction",
      "paragraphs": [
        {
          "id": "p-1",
          "text": "First paragraph text..."
        }
      ]
    }
  ]
}
```

### 9.3 Paragraph / Section Mapping

The extension must map AI-selected IDs back to original DOM nodes.

This mapping is part of the MVP core because the main product value is not only summarization, but jumping back to the source text.

Preferred approach:

```text
Find candidate text blocks in the original DOM
Assign data-ai-read-map-id to each candidate node
Clone the document
Run readability extraction on the clone
Preserve data-ai-read-map-id through extraction
Send only extracted blocks with their IDs to the backend
Use returned targetId to scroll to the original DOM node
```

Fallback approach:

```text
If IDs are lost during extraction, use text fingerprint matching
to map extracted text back to the closest original DOM node.
```

Example DOM attribute:

```html
<p data-ai-read-map-id="p-12">
  Paragraph text...
</p>
```

### 9.4 AI Read Map Generation

The AI should generate a concise reading map for the page.

The reading map should include:

```text
Page overview
2 to 5 key sections
Reason each section is worth reading
Paragraph or section ID for each key section
Page quality state
```

The output should help the user decide where to read next.

The AI should not force weak sections. If the page has limited useful content, it may return fewer sections.

### 9.5 Target ID Validation

Before rendering a read map, the extension must validate all returned `targetId` values.

Validation rules:

```text
Every targetId must exist in the current page mapping
Duplicate targetIds should be merged or removed
Invalid targetIds should be dropped
If fewer than 2 valid key sections remain, show a low-confidence state or retry once
The UI should never render a Jump button that cannot resolve to a DOM node
```

This validation is required because failed jump behavior directly breaks the core experience.

### 9.6 Jump to Original Paragraph

Each key section should include a clickable action.

When the user clicks it:

```text
Scroll to the original paragraph
Temporarily highlight the paragraph
Keep the user on the original webpage
Keep the side panel open
```

This is the core MVP interaction.

The value is not just summarization. The value is grounded navigation.

### 9.7 Side Panel UI

The extension should display the read map in a side panel.

Suggested layout:

```text
AI Read Map

[Page title]

Overview
...

Key Sections

1. Main change
   Explains the central update.
   [Jump]

2. Timeline
   Shows when the change happens.
   [Jump]

3. Eligibility details
   Lists who may be affected.
   [Jump]

Page quality
High / Medium / Low

[Copy Read Map]
```

### 9.8 Copy Read Map

Users should be able to copy the generated read map.

Copied format:

```text
Title: [Page Title]
URL: [Page URL]

Overview:
...

Key Sections:
1. [Label] — [Why read]
2. [Label] — [Why read]
3. [Label] — [Why read]
```

### 9.9 Error Handling

The extension should handle common failure states gracefully.

Possible error states:

```text
No readable article-like content detected
Page text too short
Page text too long
Extraction failed
AI generation failed
Backend unavailable
Request limit reached
Unsupported page type
AI returned invalid target IDs
Page not suitable for a read map
```

Example error message:

```text
We couldn’t find enough readable content on this page.
Try opening a full article, documentation page, or blog post.
```

## 10. Output Format and Schema

### 10.1 User-Facing Output

The MVP output should be concise and actionable.

Recommended output:

```text
Overview:
[1-2 short sentences]

Key Sections:
1. [Short label]
   Why read: [short reason]
   [Jump]

2. [Short label]
   Why read: [short reason]
   [Jump]

Page quality:
[High / Medium / Low]
```

### 10.2 JSON Input Shape

The extension should send structured page content to the backend.

Example:

```json
{
  "title": "Example Page Title",
  "url": "https://example.com/article",
  "domain": "example.com",
  "sections": [
    {
      "id": "section-1",
      "heading": "Introduction",
      "paragraphs": [
        {
          "id": "p-1",
          "text": "First paragraph text..."
        },
        {
          "id": "p-2",
          "text": "Second paragraph text..."
        }
      ]
    }
  ]
}
```

### 10.3 JSON Output Shape

The backend should return structured JSON.

Example:

```json
{
  "status": "ok",
  "overview": "This page explains how the policy changed and what details are still unclear.",
  "keySections": [
    {
      "label": "Main change",
      "whyRead": "Explains the central update the page is about.",
      "targetId": "p-4"
    },
    {
      "label": "Timeline",
      "whyRead": "Shows when the change is expected to happen.",
      "targetId": "p-7"
    }
  ],
  "pageQuality": "high",
  "missingContext": [],
  "reason": ""
}
```

### 10.4 Not Suitable State

Some pages are not extraction failures, but they are not suitable for a read map.

Examples:

```text
Search result pages
Login pages
Product listing pages
Forum comment pages
Navigation-heavy pages
Dashboard pages
Pages with mostly forms
```

The model or validation layer may return:

```json
{
  "status": "not_suitable",
  "overview": "",
  "keySections": [],
  "pageQuality": "low",
  "missingContext": [],
  "reason": "The page appears to be a list page rather than a readable article."
}
```

Allowed status values:

```text
ok
not_suitable
low_confidence
```

## 11. Output Rules

The AI output must follow these rules:

```text
Use only the current page content
Do not use outside knowledge
Do not infer facts not present on the page
Do not provide legal, financial, medical, tax, immigration, investment, or safety advice
Do not tell the user what decision to make
Do not speculate about causes, motives, outcomes, or future events
Keep labels short
Keep reasons neutral
Reference original paragraph or section IDs
Avoid exaggeration
Prefer “why this section is worth reading” over advice
Do not force weak key sections
```

## 12. Product Boundary

The extension should behave like a reading navigator, not an expert advisor.

Good:

```text
This section explains the program eligibility details mentioned in the article.
```

Bad:

```text
You should apply for this program.
```

Good:

```text
This section contains the main numbers behind the report.
```

Bad:

```text
You should change your financial plan based on these numbers.
```

Good:

```text
This paragraph explains the author’s main argument.
```

Bad:

```text
This proves the author is correct.
```

## 13. Recommended Prompt Template

```text
You are helping a user skim a long webpage.

Your job is to create a clickable reading map.
Your job is not to replace the page.
Your job is to help the user decide which parts of the original page are worth reading.

Use ONLY the page content provided below.
Do not use outside knowledge.
Do not infer facts that are not stated in the page.
Do not provide legal, financial, medical, immigration, investment, tax, or safety advice.
Do not recommend what decision the user should make.
Do not speculate about causes, motives, consequences, or future outcomes unless the page explicitly states them.
Ignore navigation text, ads, newsletter prompts, comments, related links, footer content, and promotional content.

Select 2 to 5 useful sections or paragraphs.
If the page has limited useful content, return fewer sections.
Do not force weak sections.

For each selected section:
- Provide a short label
- Explain why this section is worth reading
- Return the paragraphId or sectionId
- Stay neutral
- Do not add unsupported interpretation

If the page is not suitable for a reading map, return status: "not_suitable" with a short reason.

Return valid JSON only.

JSON schema:
{
  "status": "ok | not_suitable | low_confidence",
  "overview": "string",
  "keySections": [
    {
      "label": "string",
      "whyRead": "string",
      "targetId": "string"
    }
  ],
  "pageQuality": "high | medium | low",
  "missingContext": ["string"],
  "reason": "string"
}

Rules:
- overview must be 1 to 2 short sentences.
- keySections must contain 2 to 5 items when status is ok.
- label must be under 8 words.
- whyRead must be under 20 words.
- targetId must match one of the provided paragraph or section IDs.
- pageQuality should reflect whether the extracted content is clear and complete.
- missingContext should be empty unless the page content is incomplete or unclear.
- reason should be empty when status is ok.

Page content:
{{STRUCTURED_PAGE_CONTENT}}
```

## 14. Technical Architecture

### 14.1 High-Level Architecture

```text
Chrome Extension
→ Content Script
→ Page Extractor
→ Paragraph ID Mapper
→ Background Service Worker
→ Backend API
→ AI Provider
→ Structured Read Map
→ Target ID Validator
→ Side Panel UI
→ Jump and Highlight Handler
```

### 14.2 Chrome Extension Components

Recommended components:

```text
Manifest V3
Content script
Background service worker
Side panel
Local storage
DOM extraction module
Paragraph mapping module
Target ID validation module
Jump/highlight module
```

### 14.3 Backend Components

The backend should handle:

```text
AI API key protection
Request validation
Input size limits
Prompt execution
Structured output enforcement
JSON response validation
Rate limiting
Caching
Usage logging
Error handling
```

The AI API key should never be exposed inside the Chrome extension.

## 15. Content Extraction Strategy

### 15.1 Generic Extraction

Use a readability-style extractor to identify main page content.

Possible approach:

```text
Use document body clone
Remove obvious non-content elements
Run readability extraction
Preserve headings and paragraphs
Assign paragraph IDs
Map extracted paragraphs back to DOM nodes
```

### 15.2 Section Grouping

If headings are available, group paragraphs under headings.

Example:

```text
h2 → section heading
following paragraphs → section content
```

If headings are not available, treat paragraphs as a flat list.

### 15.3 Extraction Quality Checks

Before sending content to backend, check:

```text
Page has enough readable text
Paragraph count is sufficient
Extracted text is not mostly navigation
Extracted text is not mostly links
Title exists or can be inferred
```

Suggested minimum:

```text
At least 500 characters
At least 5 paragraphs
At least 3 meaningful text blocks
```

## 16. Cost Control

The MVP should include cost controls from the beginning.

Recommended controls:

```text
Manual user trigger only
Limit maximum input length
Send cleaned structured text, not raw HTML
Cache read maps by URL and content hash
Rate limit requests
Use a low-cost model first
Validate AI output before rendering
```

### 16.1 Cache Strategy

Recommended cache key:

```text
domain + url + stable_content_hash + prompt_version
```

The hash should be computed over cleaned, structured content:

```text
title + heading hierarchy + paragraph text, in order
```

Ads, comment counts, timestamps, and other volatile page elements should be stripped before hashing.

Recommended cache value:

```text
overview
keySections
pageQuality
missingContext
createdAt
model
contentHash
promptVersion
```

### 16.2 Input Limit

The backend should enforce a maximum input size.

For very long pages:

```text
Keep title and headings
Keep paragraph IDs
Truncate after a configured token limit
Prefer preserving the beginning, headings, and paragraph order
```

## 17. Privacy Requirements

The extension should be transparent and minimal.

Privacy principles:

```text
Only process the current page after user action
Only send readable page content required for generating the read map
Do not collect full browsing history
Do not automatically process pages in the background
Do not store full page text unless necessary
Do not process password fields, forms, private messages, or account pages
Do not claim the AI output replaces the original page
```

The product should clearly explain:

```text
What page content is accessed
When content is accessed
Why content is sent to the backend
What data is stored
How users can stop using the extension
```

## 18. Chrome Permissions

The MVP should request minimum permissions.

Recommended permissions:

```text
activeTab
scripting
storage
sidePanel
```

Host permissions should be limited where possible.

For early testing, broader permissions may be convenient, but production should keep permissions as narrow as possible.

## 19. Usage Logging

The MVP should collect lightweight technical and product signals.

Useful events:

```text
read_map_requested
content_extraction_success
content_extraction_failed
read_map_success
read_map_failed
jump_clicked
copy_clicked
cache_hit
cache_miss
target_id_validation_failed
not_suitable_returned
```

Useful metadata:

```text
domain
url_hash
content_length_bucket
paragraph_count_bucket
generation_latency
error_type
model_name
page_quality
number_of_key_sections
valid_target_count
```

Avoid collecting:

```text
Full browsing history
Sensitive page content
Form inputs
Private messages
Account information
Personal information
API keys
```

## 20. Success Metrics

### 20.1 Technical Metrics

```text
Readable content extraction success rate >= 80%
AI JSON response validity >= 95%
Jump target success rate >= 90%
Target ID validation pass rate >= 90%
Average generation time <= 8 seconds
Cached response time <= 1 second
```

### 20.2 Product Metrics

```text
Read maps generated per user
Jump clicks per read map
Copy clicks per read map
Repeat usage rate
7-day retention
Most common supported domains
Failure rate by domain
```

### 20.3 Quality Metrics

```text
Selected sections are actually useful
Key sections map to correct original paragraphs
Output stays grounded in page content
No unsupported claims
No professional advice
No exaggerated wording
Reasons are short and neutral
Not-suitable state is used appropriately
```

## 21. MVP Acceptance Criteria

The MVP is complete when:

```text
The Chrome extension can be installed locally
The user can manually generate a read map for a long webpage
The extension extracts title, headings, and paragraphs
The extension assigns IDs to paragraphs or sections
The extension can map returned target IDs back to original DOM nodes
The backend returns structured JSON
The side panel displays an overview and 2 to 5 key sections when enough content exists
Each rendered key section has a working jump target
Clicking Jump scrolls to and highlights the original paragraph
The UI never renders a broken Jump button
The output is based only on current page content
The output avoids legal, financial, medical, tax, immigration, investment, and safety advice
The AI API key is not exposed in the extension
The extension handles extraction and generation failures gracefully
The extension handles not-suitable pages gracefully
Basic caching is implemented
Basic rate limiting is implemented
Basic privacy explanation is available
```

## 22. Development Phases

### Phase 1: Chrome Extension Skeleton

Goal:

```text
Create a working local Chrome extension.
```

Tasks:

```text
Set up Manifest V3
Add side panel or popup
Add content script
Add background service worker
Create basic Generate button
```

Deliverable:

```text
Local extension that can run on the current page after user click.
```

### Phase 2: Page Extraction and Paragraph Mapping

Goal:

```text
Extract readable page content and map it back to DOM nodes.
```

Tasks:

```text
Extract title, headings, and paragraphs
Assign paragraph IDs to original DOM nodes
Preserve IDs through readability extraction
Create structured page content JSON
Add extraction quality checks
Add text fingerprint fallback for lost mappings
```

Deliverable:

```text
Extension can extract paragraphs and scroll to a selected paragraph ID.
```

### Phase 3: Backend and AI Read Map

Goal:

```text
Generate a structured reading map from extracted page content.
```

Tasks:

```text
Create backend API
Add AI provider integration
Implement prompt
Enforce structured output
Validate JSON response
Add not_suitable status handling
Add error handling
Add input size limits
```

Deliverable:

```text
Backend returns overview and key sections with target IDs.
```

### Phase 4: Side Panel, Target Validation, and Jump

Goal:

```text
Display the read map and support reliable jump interactions.
```

Tasks:

```text
Render overview
Render key sections
Validate target IDs before rendering
Add Jump buttons only for valid targets
Add highlight behavior
Add Copy button
Add loading and error states
Add low-confidence state
```

Deliverable:

```text
End-to-end MVP: generate read map, click key section, jump to original paragraph.
```

### Phase 5: Cost, Privacy, and Private Testing

Goal:

```text
Prepare the MVP for private testing.
```

Tasks:

```text
Add caching
Add rate limiting
Add lightweight logging
Add privacy explanation
Test on real long webpages
Collect extraction failures
Collect target mapping failures
Collect user feedback
```

Deliverable:

```text
Private-test-ready MVP.
```

## 23. Main Risks

### 23.1 Paragraph Mapping May Be Hard

Some pages transform content dynamically or have complex DOM structures.

Mitigation:

```text
Start with article-like pages
Assign IDs before readability extraction
Use simple paragraph-level mapping first
Fall back to text fingerprint matching
Track failed pages
```

### 23.2 AI May Pick Weak Sections

The AI may choose paragraphs that are not actually useful.

Mitigation:

```text
Use clear prompt criteria
Allow 2 to 5 sections instead of forcing 3 to 5
Ask for whyRead explanations
Collect user feedback
Test across page types
```

### 23.3 Extraction May Include Noise

The extracted text may include ads, navigation, related links, or comments.

Mitigation:

```text
Use readability extraction
Remove common noisy elements
Filter link-heavy blocks
Add domain-specific cleanup later
```

### 23.4 Cost May Grow

Long pages can use many tokens.

Mitigation:

```text
Manual trigger only
Input length limits
Caching
Low-cost model
Rate limiting
```

### 23.5 User Trust

Users may not trust AI-selected sections if they feel disconnected from the page.

Mitigation:

```text
Always jump to original text
Highlight source paragraph
Keep output short
Avoid unsupported interpretation
Make the original page the source of truth
```

## 24. Fast-Follow: BYOK Mode

BYOK mode allows users to power the extension with their own AI provider API key.

This is useful for:

```text
Heavy users
Developers
Technical users who already have an API key
Users who do not want to be limited by the free daily quota
```

BYOK should be treated as a fast-follow feature. It should not block the first private test.

### 24.1 Why BYOK

Free mode keeps the product accessible with zero setup, but every free-mode request costs the product owner money.

BYOK gives a subset of users a way to use the extension without consuming the product’s free quota or backend AI budget.

### 24.2 BYOK Scope

Initial BYOK support should start with one provider.

Recommended initial provider:

```text
Anthropic
```

OpenAI BYOK should be treated as a technical spike until the exact endpoint, CORS behavior, structured output support, and Chrome extension permission requirements are verified.

### 24.3 BYOK Flow

```text
User opens Settings
→ User selects “Use my own API key”
→ User selects provider
→ Extension requests provider host permission
→ User enters API key
→ Extension validates key with lightweight request
→ Extension stores key locally
→ Future read maps call provider directly from the browser
```

BYOK mode is not limited by the product’s free daily quota, but it is still subject to the user’s provider account limits, billing status, model access, regional availability, and rate limits.

### 24.4 Provider Router

The provider router should keep the rest of the product provider-agnostic.

Interface:

```text
generateReadMap(structuredPageContent, providerConfig) → ReadMapResult

providerConfig =
  { mode: "free" }
  | { mode: "byok", provider: "anthropic", apiKey, model }
```

The AI call is the only thing that forks.

Shared code paths:

```text
Extraction
Prompt content
Output schema
Output validation
Target ID validation
Side panel UI
Jump/highlight behavior
```

### 24.5 BYOK Key Storage Boundary

User API keys are stored only in `chrome.storage.local` on the current device.

The key is never synced through `chrome.storage.sync`, never sent to the product backend, never logged, and never included in analytics or error reports.

Local obfuscation may be used to reduce accidental exposure, but the product should not claim strong encryption unless the key is protected by a user-provided passphrase or platform-backed secure storage.

The user must be able to remove the key at any time.

### 24.6 BYOK Privacy Copy

Suggested settings copy:

```text
Your API key is stored only on this device.

In BYOK mode, page content is sent directly to [Provider]
from your browser. It does not pass through our servers.

Requests in BYOK mode may incur charges on your provider account.
```

### 24.7 BYOK Cache Policy

For MVP fast-follow:

```text
Free mode: backend cache
BYOK mode: local cache only
```

Shared cache for BYOK can be reconsidered later as an explicit opt-in feature.

### 24.8 BYOK Error Handling

BYOK-specific error states:

```text
Invalid or malformed API key
API key rejected by provider
Provider account has insufficient balance
Provider quota exceeded
Provider region or network restriction
Provider request timed out
Provider returned malformed output
Selected model unavailable to this account
```

On BYOK failure, the extension should offer a one-click fallback to Free mode for that request.

## 25. Later / Technical Spikes

### 25.1 OpenAI Direct Browser Spike

Before committing to OpenAI BYOK, verify:

```text
Current CORS behavior
Supported endpoint
Structured output support
Chrome extension host permission requirements
Error shape
Direct browser request policy
```

### 25.2 Shared Cache for BYOK

Shared cache for BYOK may reduce user token cost, but it complicates the privacy story.

Treat this as a later opt-in feature.

### 25.3 Additional Providers

Potential future providers:

```text
OpenAI
Google
Local/self-hosted models
OpenRouter
```

### 25.4 Local Model Option

A local model option may be valuable for privacy-conscious users, but should not be part of MVP.

## 26. Future Directions

Possible future improvements after MVP validation:

```text
Better support for documentation pages
Better support for GitHub README files
User feedback on each selected section
“Show me only numbers”
“Show me only action items”
“Show me background”
“Show me implementation details”
Multi-page article support
Saved read maps
Daily reading queue
Team sharing
Keyboard shortcuts
Local-only model option
Additional BYOK providers
Per-provider model quality/cost picker
```

## 27. Product Principle

The core product principle is:

```text
Do not replace the original page. Help the user navigate it.
```

AI Read Map should make long webpages easier to scan, easier to understand, and easier to read selectively.

The MVP should stay focused on one job:

```text
Help users find and jump to the parts of a long webpage that are most worth reading.
```

Whether a request eventually runs on free mode or a user’s own key is an implementation detail in service of that one job. It should never change what the product does or how it behaves for the user.
