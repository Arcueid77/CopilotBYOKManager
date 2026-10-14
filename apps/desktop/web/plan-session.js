/* A small shared state machine: stale async responses cannot revive a plan. */
(function (root, factory) {
  const PlanSession = factory();
  if (typeof module === "object" && module.exports) module.exports = PlanSession;
  else root.CopilotBYOKManagerPlanSession = PlanSession;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const i18n = typeof module === "object" && module.exports ? require("./i18n.js") : globalThis.CopilotBYOKManagerI18n;
  const tr = i18n.t;
  return class PlanSession {
    constructor() { this.generation = 0; this.plan = null; this.pending = false; }
    invalidate() { this.generation += 1; this.plan = null; this.pending = false; }
    begin() { this.invalidate(); this.pending = true; return this.generation; }
    accept(generation, plan) {
      if (generation !== this.generation || !this.pending) return false;
      this.pending = false;
      if (!plan || typeof plan.id !== "string" || !Array.isArray(plan.operations)) {
        throw new Error(tr("The native preview returned an invalid plan"));
      }
      this.plan = plan;
      return true;
    }
    consume(confirmed, now = Date.now()) {
      if (!confirmed || !this.plan) throw new Error(tr("Review and confirm a fresh deployment plan"));
      const plan = this.plan;
      const expires = plan.expiresAt ?? new Date(new Date(plan.createdAt).getTime() + 15 * 60 * 1000).toISOString();
      this.invalidate();
      if (!Number.isFinite(Date.parse(expires)) || Date.parse(expires) <= now) {
        throw new Error(tr("Deployment preview expired; generate a new preview"));
      }
      return { planId: plan.id, confirmed: true };
    }
  };
});
