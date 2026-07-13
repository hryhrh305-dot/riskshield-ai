export type E8Flags = {
  observability: boolean;
  sesIngestion: boolean;
  attribution: boolean;
  creemMetadata: boolean;
  safetyAutopause: boolean;
  dashboard: boolean;
  globalKillSwitch: boolean;
};

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function getE8Flags(env: Record<string, string | undefined> = process.env): E8Flags {
  return {
    observability: enabled(env.OUTREACH_OBSERVABILITY_ENABLED),
    sesIngestion: enabled(env.SES_EVENT_INGESTION_ENABLED),
    attribution: enabled(env.ACQUISITION_ATTRIBUTION_ENABLED),
    creemMetadata: enabled(env.CREEM_ATTRIBUTION_METADATA_ENABLED),
    safetyAutopause: enabled(env.OUTREACH_SAFETY_AUTOPAUSE_ENABLED),
    dashboard: enabled(env.OUTREACH_DASHBOARD_ENABLED),
    globalKillSwitch: env.OUTREACH_GLOBAL_KILL_SWITCH?.trim().toLowerCase() === "false" ? false : true,
  };
}
