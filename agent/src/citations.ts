import { AgentError } from "./errors.js";

// A line is released only after its complete citation is present. This prevents
// an invalid label or an uncited trailing claim from reaching the browser.
export class CitationGate {
  private pending = "";
  private emitted = 0;
  private refusal = false;

  constructor(private readonly labels: ReadonlySet<string>) {}

  push(delta: string): string[] {
    this.pending = (this.pending + delta).replace(/^\s+/, "");
    if (this.pending.length > 8_000) throw new AgentError("ANSWER_UNVERIFIED", 502);
    if (this.pending.trim() === "NO_EVIDENCE" || "NO_EVIDENCE".startsWith(this.pending.trim())) return [];
    const ready: string[] = [];
    while (true) {
      const match = this.pending.match(/^([^\n]{1,1000}?\[(?:S\d+(?:,\s*S\d+)*)\])(?=\s|$)/);
      if (!match) break;
      const line = match[1];
      const citation = line.match(/\[([^\]]+)\]$/);
      if (!citation || !line.slice(0, citation.index).trim()) throw new AgentError("ANSWER_UNVERIFIED", 502);
      for (const label of citation[1].split(/,\s*/)) {
        if (!this.labels.has(label)) throw new AgentError("ANSWER_UNVERIFIED", 502);
      }
      ready.push(line + "\n");
      this.emitted += 1;
      this.pending = this.pending.slice(line.length).replace(/^\s*\n?/, "");
    }
    return ready;
  }

  finish(): { remaining: string[]; refusal: boolean } {
    if (this.pending.trim() === "NO_EVIDENCE" && this.emitted === 0) {
      this.refusal = true;
      return { remaining: [], refusal: true };
    }
    const remaining = this.push(" ");
    if (this.pending.trim() || this.emitted === 0) throw new AgentError("ANSWER_UNVERIFIED", 502);
    return { remaining, refusal: this.refusal };
  }
}
