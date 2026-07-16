// Schema v1 — the WorkItem contract (`statusmap.work.v1`).
//
// A CONTROL-PLANE ENVELOPE ONLY — the small, reviewable record that makes the map a coordination surface:
// "this node is red, here is the remediation run's state + attempt log + approval + a pointer to where the
// real work runs". It is NOT a task engine. There is deliberately NO scheduler, planner, patch executor,
// retry-policy framework, queue, or approval workflow engine here — those live in CP-C ApprovalGate /
// CP-F ExecutorPipeline / CP-G Scheduler / AgentGoal / the swarm, and the work item points at them via
// `externalRunRef`. Approval STATE is recorded here; approval MECHANICS stay in CP-C.
//
// Reuses `NodeId`/`RepoId` (ledger-v1.ts) and `SignalId` (signal-v1.ts). Additive.

import type { NodeId, RepoId } from './ledger-v1'
import type { SignalId } from './signal-v1'

export type WorkItemId = string

// The remediation lifecycle: queued → reproducing → fixing → verifying → (awaiting_approval) →
// (green | parked_red | cancelled). Mirrors PRD §7's run-state machine; the map only RECORDS it.
export type WorkItemStatus =
	| 'queued'
	| 'reproducing'
	| 'fixing'
	| 'verifying'
	| 'awaiting_approval'
	| 'green'
	| 'parked_red'
	| 'cancelled'

// A pointer to where the actual run lives — the system + its id. The work item never executes anything;
// it references the executor/goal/swarm/PR that does.
export type ExternalRunRefV1 = {
	system: 'AgentGoal' | 'ExecutorPipeline' | 'swarm' | 'github' | string
	id: string
}

// One logged attempt within the run. Phases mirror L3 reproduce → fix → verify. The verify phase emits a
// new signal (`verificationSignalId`) — a node goes green ONLY from that verification evidence (G1/G3:
// reproduction precedes fixing, and re-green requires a real artifact).
export type WorkAttemptV1 = {
	attemptId: string
	phase: 'reproduce' | 'fix' | 'verify'
	startedAt: string
	endedAt?: string
	artifactRefs?: string[]
	patchRef?: string
	judgeReason?: string
	confidence?: number
	verificationSignalId?: SignalId
}

// Approval STATE only (the recorded decision); the gate that makes the decision is CP-C ApprovalGate.
export type WorkApprovalStateV1 = {
	required: boolean
	state: 'not_required' | 'pending' | 'approved' | 'rejected'
	approvedBy?: string
	decidedAt?: string
}

export type StatusMapWorkItemV1 = {
	schemaVersion: 'statusmap.work.v1'
	workItemId: WorkItemId
	repoId: RepoId
	targetNodeId: NodeId
	sourceSignalIds: SignalId[]

	status: WorkItemStatus

	externalRunRef?: ExternalRunRefV1
	attempts: WorkAttemptV1[]
	approval: WorkApprovalStateV1

	parkedReason?: string //    set when status is 'parked_red' (an honest note — never a fake green)
}
