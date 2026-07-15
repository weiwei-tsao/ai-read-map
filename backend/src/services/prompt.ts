import type { StructuredPageContent } from 'ai-read-map-shared'

export const PROMPT_VERSION = 'v2'

export function buildPrompt(content: StructuredPageContent): string {
  return `You are helping a user skim a long webpage.

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
- label: name the specific thing at that location — an object, question,
  claim, or example from the page. Not an abstract theme.
- preview: state what the reader will find there, citing one concrete
  detail (an example, event, comparison, number, or claim) from the page.
- Return the paragraphId or sectionId
- Stay neutral
- Do not add unsupported interpretation

The test for both label and preview: if the text could describe a section of
an unrelated article, rewrite it with specifics from this page or drop the
section. Avoid filler like "explains why this matters", "provides useful
context", "explores the central idea".

A preview points at the content; it must not fully state the section's
conclusion — leave a reason to click.

Before returning, re-check every label and preview against the test above.

If the page is not suitable for a reading map, return status: "not_suitable" with a short reason.

Return valid JSON only.

Rules:
- overview must be 1 to 2 short sentences.
- keySections must contain 2 to 5 items when status is ok.
- label must be under 8 words.
- preview must be under 20 words.
- targetId must match one of the provided paragraph or section IDs.
- pageQuality should reflect whether the extracted content is clear and complete.
- missingContext should be empty unless the page content is incomplete or unclear.
- reason should be empty when status is ok.

Page content:
${JSON.stringify(content)}`
}
