import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import assert from "node:assert/strict";

const cwd = process.cwd();
const sourcePath = path.join(cwd, "src", "lib", "list-audit.ts");
const tempDir = path.join(cwd, ".codex-temp");
const tempFile = path.join(tempDir, "list-audit.test.cjs");

fs.mkdirSync(tempDir, { recursive: true });

const source = fs.readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

fs.writeFileSync(tempFile, transpiled, "utf8");

const require = createRequire(import.meta.url);
const audit = require(tempFile);

const cases = [
  {
    name: "normal business email",
    input: {
      email: "john.doe@acme.com",
      decision: "ALLOW",
      risk_score: 12,
      reasons: [
        "Valid MX records found - domain can receive email",
        "SPF record present - domain has sender authentication",
        "DMARC record present - domain protected against spoofing",
        "Domain older than 1 year - established domain (trust signal)",
      ],
      details: {
        email: {
          isDisposable: false,
          isRoleBased: false,
          hasMX: true,
          mxChecked: true,
          hasSPF: true,
          spfChecked: true,
          hasDMARC: true,
          dmarcChecked: true,
          hasDKIM: true,
          dkimChecked: true,
        },
      },
    },
    expectedQueue: "send",
  },
  {
    name: "normal Gmail",
    input: {
      email: "jane@gmail.com",
      decision: "REVIEW",
      risk_score: 34,
      reasons: [
        "Free email provider",
        "Valid MX records found - domain can receive email",
      ],
      details: {
        email: {
          isDisposable: false,
          isRoleBased: false,
          hasMX: true,
          mxChecked: true,
        },
      },
    },
    expectedQueue: "review",
  },
  {
    name: "role-based email",
    input: {
      email: "sales@acme.com",
      decision: "REVIEW",
      risk_score: 42,
      reasons: [
        "Role-based email - not a personal address (higher risk for cold outreach)",
      ],
      details: {
        email: {
          isDisposable: false,
          isRoleBased: true,
          hasMX: true,
          mxChecked: true,
        },
      },
    },
    expectedQueue: "review",
  },
  {
    name: "invalid syntax",
    input: {
      email: "bad-address",
      decision: "BLOCK",
      risk_score: 99,
      reasons: ["Invalid email format"],
      details: {
        email: {
          isDisposable: false,
          isRoleBased: false,
          hasMX: false,
          mxChecked: false,
        },
      },
    },
    expectedQueue: "suppress",
  },
  {
    name: "disposable-like email",
    input: {
      email: "temp@tempmail.org",
      decision: "BLOCK",
      risk_score: 88,
      reasons: ["Disposable email ?likely fake/temporary registration"],
      details: {
        email: {
          isDisposable: true,
          isRoleBased: false,
          hasMX: false,
          mxChecked: true,
        },
      },
    },
    expectedQueue: "suppress",
  },
  {
    name: "suspicious local part",
    input: {
      email: "ab123456@acme.com",
      decision: "REVIEW",
      risk_score: 39,
      reasons: ["Suspicious local-part pattern ?looks auto-generated"],
      details: {
        email: {
          isDisposable: false,
          isRoleBased: false,
          hasMX: true,
          mxChecked: true,
        },
      },
    },
    expectedQueue: "review",
  },
  {
    name: "hard block",
    input: {
      email: "no-mx@missing-mx.test",
      decision: "BLOCK",
      risk_score: 77,
      reasons: ["No MX records - domain cannot receive email (mailbox does not exist)"],
      details: {
        email: {
          isDisposable: false,
          isRoleBased: false,
          hasMX: false,
          mxChecked: true,
        },
      },
    },
    expectedQueue: "suppress",
  },
  {
    name: "caution / review",
    input: {
      email: "gray@acme.com",
      decision: "REVIEW",
      risk_score: 55,
      reasons: ["Temporary delivery failure ?mail server temporarily rejecting emails"],
      details: {
        email: {
          isDisposable: false,
          isRoleBased: false,
          hasMX: true,
          mxChecked: true,
          smtpChecked: true,
          tempRejected: true,
        },
      },
    },
    expectedQueue: "review",
  },
  {
    name: "allow decision",
    input: {
      email: "hello@trusted.com",
      decision: "ALLOW",
      risk_score: 8,
      reasons: [
        "MX records present - domain can receive email",
        "SPF configured",
        "DMARC configured",
      ],
      details: {
        email: {
          isDisposable: false,
          isRoleBased: false,
          hasMX: true,
          mxChecked: true,
          hasSPF: true,
          spfChecked: true,
          hasDMARC: true,
          dmarcChecked: true,
        },
      },
    },
    expectedQueue: "send",
  },
];

const decisions = cases.map((testCase) => {
  const decision = audit.buildContactAuditDecision(testCase.input);
  assert.equal(decision.queue, testCase.expectedQueue, `${testCase.name} queue mismatch`);
  assert.ok(decision.primaryReason.length > 0, `${testCase.name} missing primary reason`);
  return decision;
});

const summary = audit.buildListAuditSummary(decisions);
assert.equal(summary.total, cases.length);
assert.equal(summary.sendCount + summary.reviewCount + summary.suppressCount, cases.length);
assert.ok(summary.campaignReadinessScore >= 0 && summary.campaignReadinessScore <= 100);
assert.ok(summary.launchStatus);
assert.ok(summary.listAcceptance);
assert.ok(Array.isArray(summary.topRiskReasons));
assert.ok(Array.isArray(summary.recommendedWorkflow));
assert.ok(summary.clientRiskBrief.length > 0);

console.log("=== Single ContactAuditDecision Example ===");
console.log(JSON.stringify(decisions[0], null, 2));
console.log("\n=== Batch ListAuditSummary Example ===");
console.log(JSON.stringify(summary, null, 2));
console.log("\nAll list-audit engine smoke checks passed.");

