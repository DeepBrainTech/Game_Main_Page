import { credentialedFetch, getApiUrl, getAuthHeaders } from "@/services/apiClient";

export interface AssessmentTopicStatPayload {
  topic_key: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface AssessmentAnswerPayload {
  topic_key: string;
  question_text: string;
  user_answer: string | null;
  correct_answer: string | null;
  is_correct: boolean;
  is_timeout: boolean;
  time_spent_ms: number;
}

export interface AssessmentSessionPayload {
  subject: string;
  started_at: string;
  finished_at: string;
  duration_seconds: number;
  total_questions: number;
  correct_count: number;
  accuracy: number;
  strongest_area: string | null;
  weakest_area: string | null;
  topic_stats: AssessmentTopicStatPayload[];
  answers: AssessmentAnswerPayload[];
}

export interface AssessmentSessionSummary {
  id: number;
  subject: string;
  started_at: string;
  finished_at: string;
  duration_seconds: number;
  total_questions: number;
  correct_count: number;
  accuracy: number;
  attempt_number: number;
  strongest_area: string | null;
  weakest_area: string | null;
  topic_stats: AssessmentTopicStatPayload[];
}

export interface AssessmentSessionDetail extends AssessmentSessionSummary {
  answers: AssessmentAnswerPayload[];
}

export interface AssessmentCompareResult {
  base_session_id: number;
  target_session_id: number;
  accuracy_delta: number;
  duration_seconds_delta: number;
  correct_count_delta: number;
  topic_deltas: Array<{
    topic_key: string;
    base_accuracy: number;
    target_accuracy: number;
    delta_accuracy: number;
  }>;
  base: AssessmentSessionSummary;
  target: AssessmentSessionSummary;
}

export interface AssessmentTrendPoint {
  session_id: number;
  finished_at: string;
  accuracy: number;
  duration_seconds: number;
}

export async function createAssessmentSession(payload: AssessmentSessionPayload): Promise<{ session_id: number }> {
  const res = await credentialedFetch(getApiUrl("/api/user/assessments"), {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.detail ?? "create_assessment_failed");
  }
  const json = await res.json();
  if (!json?.data?.session_id) throw new Error("create_assessment_failed");
  return json.data as { session_id: number };
}

export async function fetchAssessmentHistory(subject = "mental-math", limit = 50, offset = 0): Promise<{
  total: number;
  list: AssessmentSessionSummary[];
}> {
  const params = new URLSearchParams({
    subject,
    limit: String(limit),
    offset: String(offset),
  });
  const res = await credentialedFetch(getApiUrl(`/api/user/assessments?${params.toString()}`), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("fetch_assessment_history_failed");
  const json = await res.json();
  return {
    total: json?.data?.total ?? 0,
    list: (json?.data?.list ?? []) as AssessmentSessionSummary[],
  };
}

export async function fetchAssessmentDetail(sessionId: number): Promise<AssessmentSessionDetail> {
  const res = await credentialedFetch(getApiUrl(`/api/user/assessments/${sessionId}`), { headers: getAuthHeaders() });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.detail ?? "fetch_assessment_detail_failed");
  }
  const json = await res.json();
  if (!json?.data) throw new Error("fetch_assessment_detail_failed");
  return json.data as AssessmentSessionDetail;
}

export async function compareAssessmentSessions(
  sessionId: number,
  targetSessionId?: number,
): Promise<AssessmentCompareResult> {
  const suffix = targetSessionId ? `?target_session_id=${encodeURIComponent(String(targetSessionId))}` : "";
  const res = await credentialedFetch(getApiUrl(`/api/user/assessments/${sessionId}/compare${suffix}`), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.detail ?? "compare_assessment_failed");
  }
  const json = await res.json();
  if (!json?.data) throw new Error("compare_assessment_failed");
  return json.data as AssessmentCompareResult;
}

export async function fetchAssessmentTrend(subject = "mental-math", limit = 20): Promise<AssessmentTrendPoint[]> {
  const safeLimit = Math.max(2, Math.min(100, limit));
  const params = new URLSearchParams({
    subject,
    limit: String(safeLimit),
  });
  const response = await credentialedFetch(getApiUrl(`/api/user/assessments/history/trend?${params.toString()}`), {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error("fetch_assessment_trend_failed");
  const json = await response.json();
  return (json?.data?.points ?? []) as AssessmentTrendPoint[];
}
