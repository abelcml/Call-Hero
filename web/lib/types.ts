// ===== 前后端共用契约（改动前需同步三方）=====
// 场景：悉尼本地家居维修公司 "Harbour Home Services"（水电/维修），前台被漏接电话拖累。
// 语言约定：界面与 reasons/action/summary 用英文（评委在悉尼）；suggestedReply 跟随客户语言。

export type Intent = 'booking' | 'quote' | 'complaint' | 'emergency' | 'inquiry' | 'other';
export type Channel = 'call' | 'message';
export type Urgency = 'low' | 'medium' | 'high';
export type Sentiment = 'positive' | 'neutral' | 'negative';
export type Decision = 'auto' | 'human';

export interface ExtractedFields {
  name?: string;
  phone?: string;
  address?: string;
  preferredTime?: string; // 客户原话中的时间偏好
  issue?: string;         // 问题的一句话描述
}

/** LLM 直接返回的结构（JSON） */
export interface LlmTriage {
  intent: Intent;
  fields: ExtractedFields;
  confidence: number;      // 0-1
  missing: string[];       // 缺失的关键字段名，如 ["phone","address"]
  summary: string;         // 给员工看的一句话摘要（英文）
  sentiment: Sentiment;
  urgency: Urgency;
  suggestedReply: string;  // 建议回复客户的话（跟随客户语言）
}

export interface BookingProposal {
  slot: string;   // ISO 时间字符串
  label: string;  // 展示用，如 "Thu 1 Oct, 2:00 PM"
  status: 'proposed' | 'confirmed';
}

/** POST /api/triage 的响应 */
export interface TriageResult extends LlmTriage {
  id: string;
  receivedAt: string;       // ISO
  input: string;            // 原始输入
  channel: Channel;
  decision: Decision;       // 自动处理 or 转人工
  reasons: string[];        // 决策原因（英文，展示给用户）
  action: string;           // 建议动作（英文），如 "Booked Thu 2:00 PM and sent confirmation"
  booking?: BookingProposal;
  source: 'llm' | 'fallback'; // fallback = LLM 失败，规则兜底并转人工
  latencyMs: number;
  privacy?: { masked: string[] }; // PII kinds masked before the text reached the AI, e.g. ['phone']
  origin?: 'web' | 'voice' | 'phone' | 'seed'; // where the record came from (DB source)
  status?: 'new' | 'in_progress' | 'done';     // staff follow-up status (DB)
  dbId?: string;                                // row id in public.calls
  isDemo?: boolean;                             // seeded demo row
}

export type CallSource = 'web' | 'voice' | 'phone' | 'seed';
export type CallStatus = 'new' | 'in_progress' | 'done';

export interface TriageRequest {
  text: string;
  channel?: Channel; // 默认 'call'
  source?: 'web' | 'voice' | 'phone';
}

/** 演示样例 */
export interface Scenario {
  id: string;
  label: string;   // 按钮上的短标题
  channel: Channel;
  text: string;
  expectDecision: Decision; // 预期结果，用于自测
  expectIntent: Intent;
}
