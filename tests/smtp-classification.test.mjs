import assert from "node:assert/strict";
import risk from "../src/lib/risk-engine.ts";

const { classifySmtpResponse } = risk;

assert.deepEqual(
  classifySmtpResponse(550, "550-5.1.1 The email account that you tried to reach does not exist. Please try double-checking the recipient's email address for typos or unnecessary spaces."),
  {
    valid: false,
    code: 550,
    message: "550-5.1.1 The email account that you tried to reach does not exist. Please try double-checking the recipient's email address for typos or unnecessary spaces.",
    mailboxFull: false,
    tempRejected: false,
    permanentRejected: true,
  }
);

assert.deepEqual(
  classifySmtpResponse(552, "552 5.2.2 Mailbox full"),
  {
    valid: false,
    code: 552,
    message: "552 5.2.2 Mailbox full",
    mailboxFull: true,
    tempRejected: false,
    permanentRejected: false,
  }
);

assert.deepEqual(
  classifySmtpResponse(451, "451 4.3.0 Temporary local problem"),
  {
    valid: false,
    code: 451,
    message: "451 4.3.0 Temporary local problem",
    mailboxFull: false,
    tempRejected: true,
    permanentRejected: false,
  }
);

console.log("smtp-classification.test.mjs passed");
