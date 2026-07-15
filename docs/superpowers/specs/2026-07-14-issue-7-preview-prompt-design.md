# Issue #7 — whyRead → preview：从"为什么值得读"到"那里有什么"

Spec for https://github.com/weiwei-tsao/ai-read-map/issues/7

## 问题

Prompt 要求模型 "Explain why this section is worth reading"，产出的是正确但零信息量的
抽象价值陈述——同一条描述可以套在任何不相关的文章上，无法支撑用户"点哪一段"的决策。
根因是问题本身：对文本的价值判断天然抽象化，且与 prompt 已有的
"Stay neutral / Do not add unsupported interpretation / Do not recommend what decision
the user should make" 相互挤压，通用套话成为模型唯一安全的出口。

可操作的验收判据（来自 issue）：**一条 label/preview 如果能描述一篇不相关的文章，它就是坏的。**

## 变更

### 1. Schema：`KeySection.whyRead` → `KeySection.preview`（根修复）

`shared/src/types.ts`:

```ts
export interface KeySection {
  label: string    // 该位置的具体对象/问题/主张，不是抽象主题
  preview: string  // 点进去会读到什么，须含页面里的具体细节
  targetId: string
}
```

完整改名而非只改语义：JSON 字段名对模型就是 prompt（`whyRead` 会持续把输出往
"why" 拉），对人则是撒谎的名字。monorepo 单消费者、前后端同步部署，无兼容成本。

波及（全部机械改动）：
- `shared/src/types.ts`、`shared/src/validate-read-map.test.ts` fixture
- `backend/src/services/prompt.ts`（见下）、`backend/src/services/anthropic-client.test.ts` fixture
- `extension/src/sidepanel/panel.ts`（渲染 + copy 文案）、`panel.test.ts` fixture
- `extension/src/sidepanel/panel.css`：`.section-why` → `.section-preview`

`validate-read-map.ts` 逻辑只碰 `targetId`，不变。

### 2. Prompt 重写（`backend/src/services/prompt.ts`）

替换现有 "For each selected section" 指令块（24–29 行）为：

```
For each selected section:
- label: name the specific thing at that location — an object, question,
  claim, or example from the page. Not an abstract theme.
- preview: state what the reader will find there, citing one concrete
  detail (an example, event, comparison, number, or claim) from the page.

The test for both: if the text could describe a section of an unrelated
article, rewrite it with specifics from this page or drop the section.
Avoid filler like "explains why this matters", "provides useful context",
"explores the central idea".

A preview points at the content; it must not fully state the section's
conclusion — leave a reason to click.

Before returning, re-check every label and preview against the test above.
```

设计约束：
- 特异性判据只表述一次，事前规则与返回前自查共用同一句，避免两条措辞略异的规则。
- 禁用短语只留 3 条作例证，不做长清单（模型会绕开清单继续空泛，判据才是防线）。
- "信息不足就不选" 并入已有的 "Do not force weak sections"，不重复。
- 防剧透规则保护 issue #4 的 jump 核心体验：preview 是路标不是摘要。
- Rules 区 `whyRead must be under 20 words` → `preview must be under 20 words`，上限保留。

### 3. 配套

- `PROMPT_VERSION`: `v1` → `v2`（架构 invariant：prompt 变更必须 bump，旧缓存自然失效）。

## 明确不做（YAGNI）

- 两遍生成（生成→批判→重写）：延迟与成本翻倍，先验证单遍 + 自查。
- 代码侧套话检测（validate-read-map 里做 denylist 匹配）：特异性是语义判断，代码检测误伤大。
- UI 结构变更：渲染逻辑不变，仅字段名替换。

## 验收

1. 三个 workspace typecheck + 测试全绿（fixture 机械更新后）。
2. 手动：用 issue 中的 Nuno-Icons 文章实测一次，逐条 label/preview 对照判据检查——
   能否套到不相关文章上；是否引用了页面特有的名词/例子；是否留了点击的理由。
