// High-confidence denials run before retrieval. The generation policy handles
// less obvious cases without turning a similarity score into a refusal rule.
const restricted = [
  /\b(?:salary|compensation|pay rate|hourly rate|net worth|income)\b/i,
  /\b(?:home address|personal address|phone number|mobile number|passport|identity number)\b/i,
  /\b(?:medical history|medical condition|health condition|diagnosis)\b/i,
  /\b(?:job availability|available for hire|looking for a job|seeking employment)\b/i,
  /\b(?:system prompt|developer prompt|secret key|api key|credentials|internal logs)\b/i,
  /(?:mức lương|thu nhập|địa chỉ nhà|số điện thoại|bệnh án|mật khẩu|khóa api)/iu,
];

const unrelated = [
  /\b(?:write (?:me )?code|solve (?:this|my) homework|give (?:me )?medical advice|investment advice|legal advice)\b/i,
];

export function mustDecline(message: string): boolean {
  return [...restricted, ...unrelated].some((pattern) => pattern.test(message));
}
