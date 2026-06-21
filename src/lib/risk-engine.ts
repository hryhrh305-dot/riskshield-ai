import OpenAI from "openai";
import dns from "dns/promises";
import { checkBlacklist, autoBlacklistIfHighRisk } from "@/lib/blacklist";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const deepseek = new OpenAI({ apiKey: DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });

// ============ LAYER 1: LOCAL RULES (ZERO COST) ============

export const disposableDomains = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "throwaway.email", "yopmail.com", "sharklasers.com", "trashmail.com",
  "temp-mail.org", "fakeinbox.com", "guerrillamail.org", "guerrillamail.net",
  "getnada.com", "dropmail.me", "maildrop.cc", "dispostable.com",
  "spamgourmet.com", "emailondeck.com", "mailnesia.com", "moakt.com",
  "mohmal.com", "guerrillamail.de", "guerrillamail.info",
  "pokemail.net", "spambox.us", "spambox.org", "spambox.xyz",
  "spamex.com", "mailexpire.com", "temporary-mail.net", "33mail.com",
  "eyepaste.com", "einrot.com", "jourrapide.com", "teleworm.us",
  "fleckens.hu", "superrito.com", "gustr.com", "rhyta.com",
  "dayrep.com", "armyspy.com", "cuvox.de", "dodsi.com",
  "falkcia.com", "kasmail.com", "mailcatch.com", "moakt.cc",
  "0wnd.net", "0wnd.org", "10mail.org", "20mail.eu",
  "30minutemail.com", "60minutemail.com", "6ip.us", "9ox.net",
  "abusemail.de", "anonbox.net", "anonymbox.com",
  "antichef.com", "antichef.net", "antireg.ru", "antispam.de",
  "bobmail.info", "bofthew.com", "brefmail.com",
  "bugmenever.com", "bund.us", "burstmail.info",
  "byom.de", "card.zp.ua", "casualdx.com", "cek.pm",
  "clrmail.com", "cosmorph.com", "crapmail.org", "dandikmail.com",
  "deadaddress.com", "deadspam.com", "delikkt.de",
  "devnullmail.com", "discard.email", "discardmail.com",
  "dispose.it", "disposeamail.com", "dlemail.ru",
  "dontreg.com", "dropsin.net", "duk33.com", "e4ward.com",
  "easytrashmail.com", "emailsensei.com", "emailtemporanea.com",
  "emailtemporanea.net", "emkei.cf", "emz.net", "enterto.com",
  "eramail.co.za", "etranquil.com", "etranquil.net", "etranquil.org",
  "evopo.com", "explodemail.com", "fakeinbox.net", "fakemail.fr",
  "fantasymail.de", "fightallspam.com", "fivemail.de",
  "front14.org", "fuckingduh.com", "fudgerub.com", "fyii.de",
  "garliclife.com", "getairmail.com", "giantmail.de",
  "gmial.com", "goemailgo.com", "gotmail.com", "gotmail.net", "gotmail.org",
  "grr.la", "guerrillamail.biz",
  "h.mintemail.com", "h8s.org", "hacccc.com",
  "haltospam.com", "harakirimail.com", "hartbot.de", "hatespam.org",
  "herp.in", "hi5.si", "hidemail.de", "hmail.us",
  "hochsitze.com", "hotpop.com", "hulapla.de",
  "iamunsub.com", "ieatspam.eu", "ieatspam.info", "ihateyoualot.info",
  "iheartspam.org", "imstations.com", "inbax.tk", "inbox.si",
  "incognitomail.com", "incognitomail.net", "incognitomail.org",
  "insorg-mail.info", "instant-mail.de", "ip6.li", "irish2me.com",
  "iwi.net", "jetable.com", "jetable.net", "jetable.org",
  "jnxjn.com", "junk1e.com", "kaspop.com",
  "keepmymail.com", "killmail.com", "killmail.net", "kismail.ru",
  "klassmaster.com", "klassmaster.net", "klzlk.com",
  "koszmail.pl", "kuai909.com", "kulturbetrieb.info", "kurzepost.de",
  "l33r.eu", "lackmail.net", "lags.us", "lawlita.com",
  "letthemeatspam.com", "lhsdv.com", "lifebyfood.com", "link2mail.net",
  "litedrop.com", "loadby.us", "lol.ovpn.to",
  "lolfreak.net", "lookugly.com", "lopl.co.cc",
  "lrcr.com", "lroid.com", "maboard.com", "mail-temporaire.fr",
  "mail.by", "mail.mezimages.net", "mail.zp.ua", "mail114.net",
  "mail1a.de", "mail21.cc", "mail2rss.org", "mail333.com",
  "mail4trash.com", "mailbidon.com", "mailbiz.biz", "mailblocks.com",
  "mailbucket.org", "mailcat.biz", "mailde.de", "mailde.info",
  "maildx.com", "maileater.com", "mailed.ro", "maileimer.de",
  "mailfa.tk", "mailforspam.com",
  "mailfs.com", "mailguard.me", "mailhazard.com", "mailhazard.us",
  "mailhz.me", "mailimate.com", "mailin8r.com", "mailinater.com",
  "mailinator.net", "mailinator.org", "mailinator.us",
  "mailinator0.com", "mailinator1.com", "mailinator2.com",
  "mailinator3.com", "mailinator4.com", "mailinator5.com",
  "mailinator6.com", "mailinator7.com", "mailinator8.com", "mailinator9.com",
  "mailincubator.com", "mailismagic.com", "mailjunk.com",
  "mailmetrash.com", "mailmoat.com", "mailnator.com",
  "mailnesia.com", "mailnull.com", "mailpick.biz",
  "mailprohub.com", "mailquack.com",
  "mailrock.biz", "mailsac.com", "mailscrap.com",
  "mailseal.de", "mailshell.com", "mailsiphon.com",
  "mailslapping.com", "mailslite.com",
  "mailtemp.com", "mailtemporaire.fr",
  "mailtome.de", "mailtothis.com",
  "mailzilla.com", "mailzilla.org",
  "makemetheking.com",
  "manifestgenerator.com", "manybrain.com",
  "mbx.cc", "mega.zik.dj", "meinspamschutz.de",
  "meltmail.com",
  "messagebeamer.de", "mezimages.net",
  "mierdamail.com", "migmail.net", "migmail.pl",
  "migumail.com", "mintemail.com",
  "mjukglass.nu", "moakt.ws",
  "mobi.web.id", "mobileninja.co.uk",
  "monemail.fr.nf", "monmail.fr.nf",
  "msa.minsmail.com", "mt2009.com", "mt2015.com",
  "mt2016.com", "mt2017.com", "mx0.wwwnew.eu",
  "my10minutemail.com", "mycleaninbox.net", "myemailboxy.com",
  "mymail-in.net", "mymailoasis.com", "mynetstore.de",
  "mypacks.net", "mypartyclip.de",
  "myphantomemail.com", "mysamp.de",
  "myspaceinc.com", "myspaceinc.net", "myspaceinc.org",
  "myspacepimpedup.com", "myspamless.com",
  "mytemp.email", "mytempemail.com",
  "mytempmail.com", "neomailbox.com", "nepwk.com",
  "nervmich.net", "nervtmich.net",
  "netmails.com", "netmails.net",
  "netzidiot.de", "neverbox.com", "nice-4u.com",
  "nincsmail.com", "nincsmail.hu", "nnh.com",
  "no-spam.ws", "noblepioneer.com",
  "nobulk.com", "noclickemail.com",
  "nospam.ze.tc", "nospam4.us", "nospamfor.us",
  "nospammail.net", "nospamthanks.info",
  "notmailinator.com", "nowmymail.com",
  "nurfuerspam.de", "nus.edu.sg",
  "objectmail.com", "obobbo.com",
  "odnorazovoe.ru", "oneoffemail.com",
  "onewaymail.com", "onlatedotcom.info",
  "oopi.org", "opayq.com",
  "ordinaryamerican.net", "otherinbox.com",
  "ourklips.com", "outlawspam.com",
  "ovpn.to", "owlpic.com",
  "pancakemail.com", "paplease.com",
  "pcusers.otherinbox.com", "pepbot.com",
  "pimpedupmyspace.com", "pjjkp.com",
  "plexolan.de", "pookmail.com",
  "privacy.net", "privy-mail.com",
  "privatdemail.net", "privatememail.com",
  "proxymail.eu", "prtnx.com", "prtz.eu",
  "punkass.com", "put2.net",
  "putthisinyourspamdatabase.com", "pwrby.com",
  "quickinbox.com", "quickmail.nl",
  "rcpt.at", "reallymymail.com", "realtyalerts.ca",
  "recode.me", "recursor.net", "regbypass.com",
  "regbypass.comsafe-mail.net", "rejectmail.com",
  "rklips.com", "rmqkr.net", "royal.net",
  "rppkn.com", "rtrtr.com",
  "s0ny.net", "safe-mail.net",
  "safersignup.de", "safetymail.info",
  "sandelf.de", "saynotospams.com",
  "scatmail.com", "schafmail.de",
  "schrott-email.de", "secretemail.de",
  "secure-mail.biz", "senseless-entertainment.com",
  "sendspamhere.com", "shiftmail.com",
  "shitmail.me", "shitmail.org", "shitware.nl",
  "shortmail.net",
  "shotmail.ru", "showslow.de", "sibmail.com", "sify.com",
  "sinnlos-mail.de", "siteposter.net", "skeefmail.com",
  "slaskpost.se", "slipry.net", "smellfear.com", "smellrear.com",
  "snakemail.com", "sneakemail.com", "sneakmail.de", "snkmail.com",
  "sofort-mail.de", "softpls.asia", "sogetthis.com", "soodonims.com",
  "spam.la", "spam.su", "spam4.me", "spamail.de",
  "spamarrest.com", "spamavert.com", "spambob.com", "spambog.com",
  "spamcannon.com", "spamcannon.net",
  "spamcero.com", "spamcon.org", "spamcorptastic.com",
  "spamcowboy.com", "spamcowboy.net", "spamcowboy.org", "spamday.com",
  "spamfree.eu", "spamfree24.com", "spamfree24.de",
  "spamfree24.eu", "spamfree24.info", "spamfree24.net", "spamfree24.org",
  "spamgoes.in", "spamherelots.com", "spamhole.com",
  "spamify.com", "spaminator.de", "spamkill.info", "spaml.com",
  "spaml.de", "spammotel.com", "spamobox.com", "spamoff.de",
  "spamslicer.com", "spamspot.com", "spamstack.net",
  "spamthisplease.com", "spamtrail.com",
  "speed.1s.fr", "spikio.com", "spoofmail.de", "squizzy.de",
  "startkeys.com", "stinkefinger.net", "stopmyjunkmail.com",
  "streetwisemail.com", "stuffmail.de",
  "super-auswahl.de", "supergreatmail.de", "supermailer.jp",
  "superstachel.de", "suremail.info", "svk.jp",
  "sweetxxx.de", "tagyourself.com", "talkinator.com",
  "teewars.org", "teleworm.com",
  "temp-mail.com", "temp-mail.de", "temp-mail.org",
  "tempalias.com", "tempe-mail.com", "tempemail.biz",
  "tempemail.co.za", "tempemail.com", "tempemail.net",
  "tempinbox.co.uk", "tempinbox.com", "tempmail.co", "tempmail.de",
  "tempmail.eu", "tempmail.it", "tempmail.pro", "tempmail.us",
  "tempmail2.com", "tempmaildemo.com", "tempmailer.com", "tempmailer.de",
  "tempomail.fr", "temporarily.de", "temporarioemail.com.br",
  "temporaryemail.net", "temporaryemail.us", "temporaryinbox.com",
  "temporarymailaddress.com", "tempsky.com", "tempthe.net",
  "thankyou2010.com", "thc.st", "thelimestones.com",
  "thisisnotmyrealemail.com", "thismail.net",
  "throwawayemailaddress.com", "tilien.com", "tittbit.in",
  "toke.com", "toomail.biz", "topranklist.de", "tradermail.info",
  "trash-amil.com", "trash-mail.at", "trash-mail.com", "trash-mail.de",
  "trash2009.com", "trashemail.de", "trashmail.at", "trashmail.com",
  "trashmail.de", "trashmail.me", "trashmail.net", "trashmail.org",
  "trashmail.ws", "trashmailer.com", "trashymail.com", "trashymail.net",
  "trayna.com", "trbvm.com", "trbvn.com", "trbvo.com",
  "trialmail.de", "trickmail.net", "trillianpro.com", "tryalert.com",
  "turual.com", "tvchd.com", "twoweirdtricks.com", "tyldd.com",
  "uggsrock.com", "umail.net", "upliftnow.com", "uplipht.com",
  "uroid.com", "veryrealemail.com", "vidchart.com", "viditag.com",
  "viewcastmedia.com", "viewcastmedia.net", "viewcastmedia.org",
  "vkcode.ru", "vomoto.com", "vpn.st", "vsimcard.com", "vssms.com",
  "webemail.me", "wegwerf-email-addressen.de",
  "wegwerf-email.de", "wegwerf-email.net", "wegwerf-emails.de",
  "wegwerfadresse.de", "wegwerfemail.com", "wegwerfemail.de",
  "wegwerfemail.net", "wegwerfemail.org",
  "wegwerfmail.de", "wegwerfmail.net", "wegwerfmail.org",
  "wetrainbayarea.com", "wetrainbayarea.org",
  "wh4f.org", "whatiaas.com", "whatpaas.com", "whatsaas.com",
  "whopy.com", "whyspam.me",
  "wilemail.com", "willselfdestruct.com", "winemaven.info",
  "wronghead.com", "wuzup.net", "wuzupmail.net",
  "www.e4ward.com", "wwwnew.eu", "xagloo.com", "xemaps.com",
  "xents.com", "xmaily.com", "xoxy.net", "xyzfree.net",
  "yapped.net", "yep.it", "yogamaven.com",
  "yopmail.fr", "yopmail.gq", "yopmail.net",
  "ypmail.webarnak.fr.eu.org", "yuurok.com",
  "zehnminuten.de", "zehnminutenmail.de", "zippymail.info",
  "zoaxe.com", "zoemail.org",
]);

export const roleBasedPrefixes = new Set([
  "abuse", "admin", "billing", "compliance", "contact", "devnull",
  "dns", "domains", "hello", "hostmaster", "info",
  "mail", "marketing", "newsletter", "no-reply", "noreply",
  "null", "office", "postmaster", "root", "sales", "security",
  "spam", "support", "sysadmin", "test", "usenet", "uucp", "webmaster", "www",
  "team", "help", "service", "jobs", "careers", "hr",
  "finance", "legal", "privacy", "noc",
]);

export const suspiciousTLDs = new Set([
  ".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".work",
  ".click", ".space", ".website", ".site", ".online", ".tech",
  ".store", ".fun", ".lol", ".monster", ".press", ".rest", ".gdn",
]);

// ============ LAYER 2: CACHE (ZERO COST) ============

interface CacheEntry { data: Record<string, unknown>; ts: number; }
const ipCache = new Map<string, CacheEntry>();
const dnsCache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000;


// ============ RESULT-LEVEL CACHE (24h TTL, avoids re-consuming credits) ============
const resultCache = new Map<string, { result: Record<string, unknown>; ts: number }>();
const RESULT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function getCachedResult(key: string): Record<string, unknown> | null {
  const entry = resultCache.get(key);
  if (entry && Date.now() - entry.ts < RESULT_CACHE_TTL) return entry.result;
  // Expired — clean up
  if (entry) resultCache.delete(key);
  return null;
}

export function setCachedResult(key: string, result: Record<string, unknown>): void {
  // Evict oldest if cache grows beyond 10000 entries
  if (resultCache.size > 10000) {
    const oldest = [...resultCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) resultCache.delete(oldest[0]);
  }
  resultCache.set(key, { result, ts: Date.now() });
}

export function makeResultCacheKey(email?: string | null, ip?: string | null): string {
  return [email || "", ip || ""].join("|").toLowerCase();
}

// ============ LAYER 3: EXTERNAL API HELPERS ============

export async function lookupIP(ip: string): Promise<Record<string, unknown> | null> {
  const cached = ipCache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
    return null;
  }
  try {
    const res = await fetch("http://ip-api.com/json/" + ip + "?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,proxy,hosting,mobile", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "success") return null;
    ipCache.set(ip, { data, ts: Date.now() });
    return data;
  } catch { return null; }
}

// ============ DNS HELPERS ============

export async function checkMXRecord(domain: string): Promise<{ hasMX: boolean; mxRecords: string[]; mxChecked: boolean; domainExists?: boolean }> {
  const cached = dnsCache.get("mx:" + domain);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data as { hasMX: boolean; mxRecords: string[]; mxChecked: boolean };
  }
  const dnsServers = [["114.114.114.114"], ["223.5.5.5"], ["8.8.8.8", "1.1.1.1"]];
  for (const servers of dnsServers) {
    try {
      const resolver = new dns.Resolver();
      resolver.setServers(servers);
      const records = await Promise.race([
        resolver.resolveMx(domain),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))
      ]);
      const result = { hasMX: records.length > 0, mxRecords: records.map(r => r.exchange), mxChecked: true, domainExists: true };
      dnsCache.set("mx:" + domain, { data: result as unknown as Record<string, unknown>, ts: Date.now() });
      return result;
    } catch { /* try next */ }
  }
  const result = { hasMX: false, mxRecords: [] as string[], mxChecked: true, domainExists: false };
  dnsCache.set("mx:" + domain, { data: result as unknown as Record<string, unknown>, ts: Date.now() });
  return result;
}

export async function checkSPFRecord(domain: string): Promise<{ hasSPF: boolean; spfRecord: string; spfChecked: boolean }> {
  const cached = dnsCache.get("spf:" + domain);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data as { hasSPF: boolean; spfRecord: string; spfChecked: boolean };
  }
  const dnsServers = [["114.114.114.114"], ["223.5.5.5"], ["8.8.8.8"]];
  for (const servers of dnsServers) {
    try {
      const resolver = new dns.Resolver();
      resolver.setServers(servers);
      const records = await Promise.race([
        resolver.resolveTxt(domain),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))
      ]);
      const allText = records.flatMap(r => r.join("")).join(" ").toLowerCase();
      const hasSPF = allText.includes("v=spf1");
      const spfRecord = records.map(r => r.join("")).find(t => t.toLowerCase().includes("v=spf1")) || "";
      const result = { hasSPF, spfRecord, spfChecked: true };
      dnsCache.set("spf:" + domain, { data: result as unknown as Record<string, unknown>, ts: Date.now() });
      return result;
    } catch { /* try next */ }
  }
  return { hasSPF: false, spfRecord: "", spfChecked: false };
}

export async function checkDMARCRecord(domain: string): Promise<{ hasDMARC: boolean; dmarcRecord: string; dmarcChecked: boolean; dmarcPolicy: string }> {
  const dmarcDomain = "_dmarc." + domain;
  const cached = dnsCache.get("dmarc:" + domain);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data as { hasDMARC: boolean; dmarcRecord: string; dmarcChecked: boolean; dmarcPolicy: string };
  }
  const dnsServers = [["114.114.114.114"], ["223.5.5.5"], ["8.8.8.8"]];
  for (const servers of dnsServers) {
    try {
      const resolver = new dns.Resolver();
      resolver.setServers(servers);
      const records = await Promise.race([
        resolver.resolveTxt(dmarcDomain),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))
      ]);
      const allText = records.flatMap(r => r.join("")).join(" ").toLowerCase();
      const hasDMARC = allText.includes("v=dmarc1");
      const dmarcRecord = records.map(r => r.join("")).find(t => t.toLowerCase().includes("v=dmarc1")) || "";
      let dmarcPolicy = "none";
      if (dmarcRecord.includes("p=reject")) dmarcPolicy = "reject";
      else if (dmarcRecord.includes("p=quarantine")) dmarcPolicy = "quarantine";
      const result = { hasDMARC, dmarcRecord, dmarcChecked: true, dmarcPolicy };
      dnsCache.set("dmarc:" + domain, { data: result as unknown as Record<string, unknown>, ts: Date.now() });
      return result;
    } catch { /* try next */ }
  }
  return { hasDMARC: false, dmarcRecord: "", dmarcChecked: false, dmarcPolicy: "none" };
}

// ============ LAYER 4: AI (ONLY FOR HIGH RISK) ============

export async function calculateRiskScore({
  email,
  ip,
  shouldCheckMX = true,
}: {
  email?: string | null;
  ip?: string | null;
  shouldCheckMX?: boolean;
}): Promise<{
  score: number;
  reasons: string[];
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  emailDetails: Record<string, unknown> | null;
  ipDetails: Record<string, unknown> | null;
  blacklistHits: string[];
  impact: string[];
  solution: { category: string; problem: string; fix: string }[];
}> {
  let riskScore = 0;
  const reasons: string[] = [];
  const blacklistHits: string[] = [];
  let emailDetails: Record<string, unknown> | null = null;
  let ipDetails: Record<string, unknown> | null = null;

  // ============ CATEGORY 1: FORMAT & IDENTITY CHECK ============

  if (email) {
    emailDetails = {};
    const parts = email.split("@");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      riskScore += 40;
      reasons.push("Invalid email format");
    } else {
      const domain = parts[1].toLowerCase();
      const localPart = parts[0].toLowerCase();

      // ---- 1a: Disposable / fake registration detection ----
      if (disposableDomains.has(domain)) {
        riskScore += 45;
        reasons.push("Disposable email — likely fake/temporary registration");
      }

      // ---- 1b: Role-based email detection ----
      if (roleBasedPrefixes.has(localPart)) {
        riskScore += 10;
        reasons.push("Role-based email — not a personal address");
      }

      // ---- 1c: Suspicious TLD ----
      const tld = "." + domain.split(".").pop();
      if (suspiciousTLDs.has(tld)) {
        riskScore += 20;
        reasons.push("Suspicious TLD: " + tld + " — commonly used for spam/fraud");
      }

      // ---- 1d: Suspicious local part patterns (fake registration) ----
      const randomPattern = /^[a-z]{1,3}[0-9]{4,10}$/;
      const gibberishPattern = /^[a-z]{8,20}[0-9]{3,8}$/;
      const spamKeywords = ["test", "spam", "fake", "no-reply", "noreply", "nobody", "admin", "root", "postmaster", "abuse", "support@", "info@", "sales@", "contact@"];
      if (randomPattern.test(localPart) || gibberishPattern.test(localPart)) {
        riskScore += 15;
        reasons.push("Suspicious local-part pattern — looks auto-generated");
      }
      const localLower = localPart.toLowerCase();
      for (const kw of spamKeywords) {
        if (localLower === kw || localLower.startsWith(kw.replace("@", ""))) {
          riskScore += 5;
          reasons.push("Generic/non-personal email prefix: " + kw);
          break;
        }
      }

      emailDetails.domain = domain;
      emailDetails.localPart = localPart;
      emailDetails.isDisposable = disposableDomains.has(domain);
      emailDetails.isRoleBased = roleBasedPrefixes.has(localPart);

      // ---- 1e: Blacklist check ----
      const blEmail = await checkBlacklist("email", email);
      if (blEmail) {
        riskScore += 50;
        reasons.push("Email in blacklist — flagged from previous abuse");
        blacklistHits.push("email:" + email);
      }
      const blDomain = await checkBlacklist("domain", domain);
      if (blDomain) {
        riskScore += 35;
        reasons.push("Domain in blacklist: " + domain);
        blacklistHits.push("domain:" + domain);
      }

      // ============ CATEGORY 2: DOMAIN & MAIL SERVER HEALTH ============

      if (shouldCheckMX !== false) {
        // ---- 2a: MX Record Check (mail server existence) ----
        const mx = await checkMXRecord(domain);
        emailDetails.hasMX = mx.hasMX;
        emailDetails.mxRecords = mx.mxRecords;
        emailDetails.mxChecked = mx.mxChecked;

        if (mx.mxChecked && !mx.hasMX) {
          riskScore += 40;
          reasons.push("No MX records — domain cannot receive email (mailbox does not exist)");
        } else if (!mx.mxChecked) {
          riskScore += 5;
        }

        // ---- 2b: SMTP Mailbox Existence Check (deep validation) ----
        // Attempt lightweight SMTP RCPT TO check
        if (mx.hasMX && mx.mxRecords.length > 0) {
          try {
            const smtpResult = await checkSMTPMailbox(domain, email, mx.mxRecords[0]);
            emailDetails.smtpChecked = smtpResult.checked;
            emailDetails.smtpValid = smtpResult.valid;
            emailDetails.smtpCode = smtpResult.code;
            emailDetails.smtpMessage = smtpResult.message;
            emailDetails.mailboxFull = smtpResult.mailboxFull;
            emailDetails.tempRejected = smtpResult.tempRejected;
            emailDetails.permanentRejected = smtpResult.permanentRejected;

            if (smtpResult.checked) {
              if (smtpResult.permanentRejected) {
                riskScore += 35;
                reasons.push("SMTP permanent rejection — mailbox does not exist or has been disabled");
              } else if (smtpResult.mailboxFull) {
                riskScore += 25;
                reasons.push("Recipient inbox full — your email will bounce back");
              } else if (smtpResult.tempRejected) {
                riskScore += 15;
                reasons.push("Temporary delivery failure — mail server temporarily rejecting emails");
              } else if (!smtpResult.valid) {
                riskScore += 20;
                reasons.push("SMTP validation failed — mailbox may not exist");
              }
            }
          } catch {
            // SMTP check failed silently — not all servers allow it
          }
        }

        // ---- 2c: SPF Record Check ----
        const spf = await checkSPFRecord(domain);
        emailDetails.hasSPF = spf.hasSPF;
        emailDetails.spfChecked = spf.spfChecked;
        if (spf.spfChecked && !spf.hasSPF) {
          riskScore += 10;
          reasons.push("Missing SPF record — domain lacks sender authentication");
        }

        // ---- 2d: DMARC Record Check ----
        const dmarc = await checkDMARCRecord(domain);
        emailDetails.hasDMARC = dmarc.hasDMARC;
        emailDetails.dmarcChecked = dmarc.dmarcChecked;
        emailDetails.dmarcPolicy = dmarc.dmarcPolicy;
        if (dmarc.dmarcChecked && !dmarc.hasDMARC) {
          riskScore += 10;
          reasons.push("Missing DMARC record — domain vulnerable to spoofing");
        }
        if (dmarc.dmarcPolicy === "reject") {
          riskScore -= 5; // strict DMARC is good
        }
      }

      // ---- 2e: Email deliverability assessment ----
      emailDetails.inboxProbability = "high";
      if (emailDetails.hasMX === false && emailDetails.mxChecked) {
        emailDetails.inboxProbability = "none";
        emailDetails.estimatedBounceRate = "100% (guaranteed bounce — domain has no mail server)";
      } else if (emailDetails.isDisposable) {
        emailDetails.inboxProbability = "none";
        emailDetails.estimatedBounceRate = ">90% (disposable — expires within minutes)";
      } else if (emailDetails.smtpChecked && emailDetails.permanentRejected) {
        emailDetails.inboxProbability = "none";
        emailDetails.estimatedBounceRate = "100% (mailbox rejected permanently)";
      } else if (emailDetails.smtpChecked && emailDetails.mailboxFull) {
        emailDetails.inboxProbability = "none";
        emailDetails.estimatedBounceRate = "100% (inbox full — cannot accept new mail)";
      } else if (emailDetails.smtpChecked && emailDetails.tempRejected) {
        emailDetails.inboxProbability = "low";
        emailDetails.estimatedBounceRate = "50-70% (temporary delivery issues)";
      } else if (!emailDetails.hasSPF && emailDetails.spfChecked && !emailDetails.hasDMARC && emailDetails.dmarcChecked) {
        emailDetails.inboxProbability = "low";
        emailDetails.estimatedBounceRate = "30-60% (no SPF or DMARC)";
      } else if (!emailDetails.hasSPF && emailDetails.spfChecked) {
        emailDetails.inboxProbability = "medium";
        emailDetails.estimatedBounceRate = "20-40% (missing SPF)";
      } else {
        emailDetails.estimatedBounceRate = "<5% (normal)";
      }

      // ---- 2f: Sender reputation risk ----
      if (emailDetails.hasMX === false && emailDetails.mxChecked) {
        emailDetails.senderReputationRisk = "CRITICAL — sending to non-existent domains damages your sender reputation score";
      } else if (emailDetails.isDisposable) {
        emailDetails.senderReputationRisk = "HIGH — disposable addresses cause bounced emails; ESPs (Gmail/Outlook) may throttle or blacklist your sending IP";
      } else if (emailDetails.smtpChecked && emailDetails.permanentRejected) {
        emailDetails.senderReputationRisk = "HIGH — repeatedly sending to invalid mailboxes damages your sender reputation";
      } else if (emailDetails.smtpChecked && emailDetails.mailboxFull) {
        emailDetails.senderReputationRisk = "MEDIUM — bounced emails from full inboxes still count against your reputation";
      } else if (!emailDetails.hasSPF && emailDetails.spfChecked) {
        emailDetails.senderReputationRisk = "MEDIUM — recipient domain lacks authentication; your emails may be flagged as spam";
      } else {
        emailDetails.senderReputationRisk = "LOW — normal sending will not harm your reputation";
      }
    }
  }

  // ============ CATEGORY 3: IP ANALYSIS ============

  if (ip) {
    ipDetails = {};
    const blIP = await checkBlacklist("ip", ip);
    if (blIP) {
      riskScore += 50;
      reasons.push("IP in blacklist — previously reported for abuse");
      blacklistHits.push("ip:" + ip);
    }

    const geoData = await lookupIP(ip);
    if (geoData) {
      ipDetails.country = geoData.country;
      ipDetails.countryCode = geoData.countryCode;
      ipDetails.region = geoData.regionName;
      ipDetails.city = geoData.city;
      ipDetails.isp = geoData.isp;
      ipDetails.org = geoData.org;
      ipDetails.asn = geoData.as;

      // ---- 3a: Proxy/VPN detection ----
      if (geoData.proxy) {
        riskScore += 35;
        reasons.push("Proxy/VPN detected — cannot verify real identity or location");
      }
      ipDetails.isProxy = !!geoData.proxy;

      // ---- 3b: Hosting/datacenter IP ----
      if (geoData.hosting) {
        riskScore += 25;
        reasons.push("Datacenter/hosting IP — likely automated traffic, not a real person");
      }
      ipDetails.isHosting = !!geoData.hosting;
      ipDetails.isMobile = !!geoData.mobile;

      // ---- 3c: ISP hosting detection ----
      const isp = ((geoData.isp as string) || "").toLowerCase();
      const hostingKeywords = ["hosting", "vps", "server", "cloud", "datacenter", "digitalocean", "linode", "vultr", "ovh", "hetzner", "aws", "azure", "google cloud"];
      const isHostingISP = hostingKeywords.some(k => isp.includes(k));
      if (isHostingISP && !geoData.hosting) {
        riskScore += 12;
        reasons.push("ISP associated with hosting provider — potential bot/VPN traffic");
      }
      ipDetails.isHostingISP = isHostingISP;

      // ---- 3d: High-risk country ----
      const highRiskCountries = new Set(["NG", "RU", "IR", "KP", "BY", "VE", "UA", "SY", "SD", "CU", "PK", "KH", "BD"]);
      const countryCode = (geoData.countryCode as string) || "";
      if (highRiskCountries.has(countryCode)) {
        riskScore += 20;
        reasons.push("High-risk country: " + (geoData.country || countryCode));
      }
      ipDetails.highRiskCountry = highRiskCountries.has(countryCode);
    } else {
      riskScore += 5;
    }
  }

  // ============ CATEGORY 4: COMPREHENSIVE SCORING & SOLUTION MAPPING ============

  riskScore = Math.min(riskScore, 100);

  // Auto-blacklist for very high risk
  if (email && riskScore >= 85) {
    autoBlacklistIfHighRisk({ type: "email", value: email, risk_score: riskScore, reasons }).catch(() => {});
    if (email.split("@")[1]) {
      autoBlacklistIfHighRisk({ type: "domain", value: email.split("@")[1].toLowerCase(), risk_score: riskScore, reasons }).catch(() => {});
    }
  }
  if (ip && riskScore >= 85) {
    autoBlacklistIfHighRisk({ type: "ip", value: ip, risk_score: riskScore, reasons }).catch(() => {});
  }

  const decision: "ALLOW" | "REVIEW" | "BLOCK" = riskScore >= 70 ? "BLOCK" : riskScore >= 40 ? "REVIEW" : "ALLOW";

  // ============ BUSINESS IMPACT ============
  const impact: string[] = [];
  if (riskScore >= 70) {
    impact.push("[CRITICAL] Do NOT send or reply. High risk of bounce, sender reputation damage, or fraud.");
  } else if (riskScore >= 40) {
    impact.push("[CAUTION] Risk signals detected. Manual review recommended before sending.");
  } else {
    impact.push("[SAFE] No significant risk detected. Safe to send.");
  }

  // Email-related impacts
  if (emailDetails?.isDisposable) {
    impact.push("[FAKE REGISTRATION] This is a disposable/temporary email. The address will self-destruct within minutes. Do NOT send — it will bounce and hurt your sender reputation.");
  }
  if (emailDetails?.hasMX === false && emailDetails?.mxChecked) {
    impact.push("[MAILBOX DOES NOT EXIST] Domain has no mail server. Your email will be returned as undeliverable. Repeated bounces lower your sender score with Gmail/Outlook.");
  }
  if (emailDetails?.smtpChecked && emailDetails?.permanentRejected) {
    impact.push("[MAILBOX DISABLED] SMTP server permanently rejected this address. The mailbox has been deleted or disabled — guaranteed bounce.");
  }
  if (emailDetails?.smtpChecked && emailDetails?.mailboxFull) {
    impact.push("[INBOX FULL] Recipient mailbox is over quota. Your email will be rejected until they free up space. Wait a few days before retrying.");
  }
  if (emailDetails?.smtpChecked && emailDetails?.tempRejected) {
    impact.push("[TEMPORARY BLOCK] Mail server is temporarily rejecting emails. This could be greylisting or rate limiting. Retry in 15-30 minutes.");
  }

  // IP-related impacts
  if (ipDetails?.isProxy) {
    impact.push("[HIDDEN IDENTITY] Proxy/VPN detected. Cannot verify if this is a real customer or a fraudster. Request additional verification (phone, company website, LinkedIn).");
  }
  if (ipDetails?.highRiskCountry) {
    impact.push("[HIGH-RISK REGION] IP originates from a region with historically low conversion rates and high fraud. Prioritize leads from other regions first.");
  }
  if (ipDetails?.isHosting) {
    impact.push("[NOT A REAL PERSON] Datacenter IP detected. Real customers do not send inquiries from server IPs. Likely automated bot or scraper.");
  }

  if (reasons.length === 0) {
    impact.push("[ALL CLEAR] No risk signals detected. This email/IP appears legitimate. You can proceed with confidence.");
  }

  // ============ SOLUTIONS (ACTIONABLE FIXES FOR EACH PROBLEM) ============
  const solution: { category: string; problem: string; fix: string }[] = [];

  // Solution 1: Sender reputation blacklisted
  if (blacklistHits.length > 0) {
    solution.push({
      category: "Sender Reputation Risk",
      problem: "This email or IP is on a known abuse blacklist. Sending to it will damage your sender reputation and may cause your own domain/IP to be blacklisted.",
      fix: "1) Do NOT send email to this address. 2) If this is a customer inquiry, ask them to contact you from a different email. 3) Monitor your own sender reputation via Google Postmaster Tools or MXToolbox. 4) If your domain gets blacklisted, submit a delisting request to the blacklist operator (Spamhaus, Barracuda, etc.)."
    });
  }

  // Solution 2: Mailbox full
  if (emailDetails?.smtpChecked && emailDetails?.mailboxFull) {
    solution.push({
      category: "Inbox Full / Over Quota",
      problem: "The recipient's mailbox has exceeded its storage limit. Any email you send will be rejected with a 'mailbox full' bounce.",
      fix: "1) Wait 3-5 days before retrying — the recipient needs time to clear space. 2) Try reaching out via alternative channels (LinkedIn, WhatsApp, phone). 3) If this is a business contact, their IT department may need to increase mailbox quota. 4) Set a follow-up reminder in your CRM rather than repeatedly bouncing."
    });
  }

  // Solution 3: Temporary rejection
  if (emailDetails?.smtpChecked && emailDetails?.tempRejected) {
    solution.push({
      category: "Temporary Delivery Block",
      problem: "The recipient mail server is temporarily refusing emails. This is often due to greylisting (anti-spam technique) or rate limiting.",
      fix: "1) Wait 15-30 minutes and retry — greylisting usually clears after one retry. 2) Ensure your email server has proper SPF/DKIM/DMARC configured. 3) If persists for >24 hours, the receiving server may have permanently blocked your IP range — contact their postmaster. 4) Use a reputable email sending service (SendGrid, AWS SES) to improve deliverability."
    });
  }

  // Solution 4: Mailbox doesn't exist / permanently rejected
  if (emailDetails?.smtpChecked && emailDetails?.permanentRejected) {
    solution.push({
      category: "Mailbox Does Not Exist / Disabled",
      problem: "The SMTP server confirmed this mailbox does not exist or has been permanently disabled. Emails to this address will always bounce.",
      fix: "1) Remove this email from your contact list immediately — never send to it again. 2) Each bounce damages your sender reputation. 3) If this was a customer inquiry, they may have made a typo — try common corrections (gmail.com vs gmial.com). 4) Use double opt-in for mailing lists to prevent invalid addresses from entering your database."
    });
  }

  // Solution 5: No MX records (domain can't receive mail)
  if (emailDetails?.hasMX === false && emailDetails?.mxChecked) {
    solution.push({
      category: "Domain Cannot Receive Email",
      problem: "The domain has no MX (Mail Exchange) records configured. This means the domain literally cannot accept email — like sending a letter to an address that doesn't exist.",
      fix: "1) Do NOT send to this domain — 100% guaranteed bounce. 2) The domain owner needs to configure MX records with their DNS provider. 3) If this is a business contact, their email may be misconfigured — ask them to check with their IT team. 4) Common MX providers: Google Workspace, Microsoft 365, Zoho Mail."
    });
  }

  // Solution 6: Email already expired / disposable
  if (emailDetails?.isDisposable) {
    solution.push({
      category: "Fake / Temporary Email (Disposable)",
      problem: "This is a disposable email address from a temporary email service. These addresses typically self-destruct in 10-60 minutes and are commonly used for fraudulent signups.",
      fix: "1) Do NOT send any business communication to this address — it has likely already expired. 2) If this came from a signup form, the user is likely fraudulent. 3) Require email verification (double opt-in) for all new signups. 4) Block disposable email domains at the registration level to prevent fake accounts."
    });
  }

  // Solution 7: IP Proxy/VPN (hidden identity)
  if (ipDetails?.isProxy) {
    solution.push({
      category: "Hidden Identity (Proxy/VPN)",
      problem: "The user is hiding behind a proxy or VPN service. Their real location and identity cannot be verified, which is a common fraud signal in e-commerce and trade.",
      fix: "1) Request additional identity verification: company website, LinkedIn profile, business registration number. 2) Require a video call or phone verification before proceeding with orders. 3) Check if the company name matches the claimed country. 4) For high-value transactions, require payment via wire transfer (harder to reverse than credit cards)."
    });
  }

  // Solution 8: High-risk country IP
  if (ipDetails?.highRiskCountry) {
    const c = ipDetails?.country || "this region";
    solution.push({
      category: "High-Risk Region IP",
      problem: "IP originates from " + c + ", a region with historically high fraud rates and low inquiry-to-order conversion in international trade.",
      fix: "1) Do not invest significant time before verifying the buyer is legitimate. 2) Request a 30% advance payment (T/T) before production. 3) Use a trusted third-party inspection service for orders from this region. 4) Check the company against trade blacklists and the local chamber of commerce. 5) Consider requiring L/C (Letter of Credit) payment terms."
    });
  }

  // Solution 9: Weak domain security (no SPF/DMARC)
  if ((emailDetails?.hasSPF === false && emailDetails?.spfChecked) || (emailDetails?.hasDMARC === false && emailDetails?.dmarcChecked)) {
    solution.push({
      category: "Weak Domain Security",
      problem: "The recipient's domain lacks SPF and/or DMARC authentication. This makes the domain easy to spoof, and your emails to them are more likely to land in spam folders.",
      fix: "1) Your email may go to spam — ask the recipient to whitelist your domain. 2) If you are the domain owner, add SPF and DMARC records to improve deliverability. 3) Use a professional email sending service with proper authentication. 4) Monitor your email deliverability rates in your ESP dashboard."
    });
  }

  if (solution.length === 0 && reasons.length === 0) {
    solution.push({
      category: "No Issues Detected",
      problem: "This email and IP appear legitimate with no detectable risk signals.",
      fix: "Proceed with normal business communication. Recommended: always verify new customers via a welcome email and track engagement metrics."
    });
  }

  return { score: riskScore, reasons, decision, emailDetails, ipDetails, blacklistHits, impact, solution };
}



﻿// ============ WHOIS DOMAIN AGE CHECK ============

export async function checkDomainAge(domain: string): Promise<{
  checked: boolean;
  createdDate: string | null;
  ageDays: number | null;
  ageYears: number | null;
  isNew: boolean;
  registrar: string | null;
}> {
  const result = { checked: false, createdDate: null as string | null, ageDays: null as number | null, ageYears: null as number | null, isNew: false, registrar: null as string | null };
  try {
    // Use free RDAP protocol (successor to WHOIS) — no API key needed
    const res = await fetch("https://rdap.verisign.com/domain/v1/" + domain, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      // Try IANA RDAP bootstrap
      const bootstrap = await fetch("https://rdap.iana.org/domain/" + domain, { signal: AbortSignal.timeout(3000) });
      if (!bootstrap.ok) return result;
    }
    const data = await res.json();
    const events = data.events || [];
    for (const ev of events) {
      if (ev.eventAction === "registration") {
        result.createdDate = ev.eventDate;
        result.checked = true;
        const created = new Date(ev.eventDate);
        const now = new Date();
        result.ageDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        result.ageYears = Math.round(result.ageDays / 365 * 10) / 10;
        result.isNew = result.ageDays < 90;
        break;
      }
    }
    // Try to get registrar
    const entities = data.entities || [];
    for (const ent of entities) {
      if (ent.roles && ent.roles.includes("registrar")) {
        result.registrar = ent.vcardArray?.[1]?.[1]?.[3] || null;
        break;
      }
    }
    return result;
  } catch {
    return result;
  }
}

// ============ DNS HEALTH SCORE ============

export async function getDNSHealthScore(domain: string): Promise<{
  score: number;
  mx: boolean;
  spf: boolean;
  dmarc: boolean;
  dmarcPolicy: string;
  details: string[];
}> {
  const [mx, spf, dmarc] = await Promise.all([
    checkMXRecord(domain),
    checkSPFRecord(domain),
    checkDMARCRecord(domain),
  ]);
  let score = 0;
  const details: string[] = [];
  if (mx.hasMX && mx.mxChecked) { score += 30; details.push("MX: OK"); }
  else if (mx.mxChecked) { details.push("MX: MISSING"); }
  else { score += 10; details.push("MX: Unknown"); }

  if (spf.hasSPF && spf.spfChecked) { score += 25; details.push("SPF: Present"); }
  else if (spf.spfChecked) { details.push("SPF: Missing"); }

  if (dmarc.hasDMARC && dmarc.dmarcChecked) {
    score += 25;
    details.push("DMARC: Present (" + dmarc.dmarcPolicy + ")");
    if (dmarc.dmarcPolicy === "reject") score += 10;
  } else if (dmarc.dmarcChecked) { details.push("DMARC: Missing"); }

  // Bonus for all three
  if (mx.hasMX && spf.hasSPF && dmarc.hasDMARC) score += 10;
  return {
    score: Math.min(100, score),
    mx: mx.hasMX && mx.mxChecked,
    spf: spf.hasSPF && spf.spfChecked,
    dmarc: dmarc.hasDMARC && dmarc.dmarcChecked,
    dmarcPolicy: dmarc.dmarcPolicy,
    details,
  };
}

// ============ SMTP MAILBOX VALIDATION ============

export async function checkSMTPMailbox(domain: string, email: string, mxHost: string): Promise<{
  checked: boolean;
  valid: boolean;
  code: number;
  message: string;
  mailboxFull: boolean;
  tempRejected: boolean;
  permanentRejected: boolean;
}> {
  const net = await import("net");
  const result = { checked: false, valid: false, code: 0, message: "", mailboxFull: false, tempRejected: false, permanentRejected: false };

  try {
    const smtpCheck = new Promise<typeof result>((resolve) => {
      const socket = new net.Socket();
      let stage = 0;
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ ...result, checked: false, message: "SMTP timeout" });
      }, 4000);

      socket.connect(25, mxHost);

      socket.on("data", (data: Buffer) => {
        const response = data.toString();
        const code = parseInt(response.substring(0, 3)) || 0;

        if (stage === 0) {
          socket.write("HELO riskshield.ai\r\n");
          stage = 1;
        } else if (stage === 1) {
          socket.write("MAIL FROM:<noreply@riskshield.ai>\r\n");
          stage = 2;
        } else if (stage === 2) {
          socket.write("RCPT TO:<" + email + ">\r\n");
          stage = 3;
        } else if (stage === 3) {
          clearTimeout(timeout);
          socket.write("QUIT\r\n");
          socket.destroy();

          if (code >= 200 && code < 300) {
            resolve({ checked: true, valid: true, code, message: response.trim(), mailboxFull: false, tempRejected: false, permanentRejected: false });
          } else if (code >= 400 && code < 500) {
            const isFull = response.toLowerCase().includes("quota") || response.toLowerCase().includes("full") || response.toLowerCase().includes("space");
            resolve({ checked: true, valid: false, code, message: response.trim(), mailboxFull: isFull, tempRejected: !isFull, permanentRejected: false });
          } else if (code >= 500) {
            const isFull = response.toLowerCase().includes("quota") || response.toLowerCase().includes("full") || response.toLowerCase().includes("space");
            resolve({ checked: true, valid: false, code, message: response.trim(), mailboxFull: isFull, tempRejected: false, permanentRejected: !isFull });
          } else {
            resolve({ ...result, checked: true, valid: false, code, message: response.trim() });
          }
        }
      });

      socket.on("error", () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ ...result, checked: false, message: "Connection refused" });
      });

      socket.on("timeout", () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ ...result, checked: false, message: "Connection timeout" });
      });
    });

    return await smtpCheck;
  } catch {
    return result;
  }
}


export async function getAIExplanation(email: string | null, ip: string | null, riskScore: number, reasons: string[]): Promise<string> {
  if (riskScore < 70) return "";
  try {
    const summary = "Email: " + (email || "N/A") + ", IP: " + (ip || "N/A") + ", Score: " + riskScore + ", Reasons: " + (reasons.join(", ") || "none");
    const completion = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "system", content: "You are a fraud detection AI. Explain in one short Chinese sentence why this request was flagged." }, { role: "user", content: summary }],
      max_tokens: 80, temperature: 0.3,
    });
    return completion.choices[0]?.message?.content?.trim() || "";
  } catch { return ""; }
}

// ============ SCORING ENGINE ============

export interface RiskScoreResult {
  score: number;
  reasons: string[];
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  emailDetails: Record<string, unknown> | null;
  ipDetails: Record<string, unknown> | null;
  blacklistHits: string[];
  impact: string[];
}


// ============ COMPANY HEALTH SCORE (COMPREHENSIVE) ============

export interface CompanyHealthResult {
  healthScore: number;
  grade: string;
  stars: string;
  label: string;
  positiveSignals: string[];
  riskSignals: string[];
  recommendation: string;
  breakdown: {
    emailTrust: { score: number; weight: number; details: string };
    domainAge: { score: number; weight: number; details: string };
    dnsHealth: { score: number; weight: number; details: string };
    ipReputation: { score: number; weight: number; details: string };
    companyExistence: { score: number; weight: number; details: string };
    negativeSignals: { penalty: number; weight: number; details: string };
  };
}

export async function calculateCompanyHealth(params: {
  riskScore: number;
  isDisposable: boolean;
  hasMX: boolean;
  hasSPF: boolean;
  hasDMARC: boolean;
  dmarcPolicy: string;
  domainAgeDays: number | null;
  isProxy: boolean;
  isHosting: boolean;
  blacklistHits: string[];
  country: string | null;
  companyName?: string | null;
}): Promise<CompanyHealthResult> {
  const {
    riskScore, isDisposable, hasMX, hasSPF, hasDMARC, dmarcPolicy,
    domainAgeDays, isProxy, isHosting, blacklistHits, country,
  } = params;

  // === Email Trust (25%) ===
  let emailTrust = 100;
  if (isDisposable) emailTrust = 0;
  else if (!hasMX) emailTrust = 10;
  else {
    if (riskScore > 70) emailTrust = Math.max(0, 100 - riskScore);
    else emailTrust = 100 - Math.round(riskScore * 0.6);
  }
  const emailTrustW = 25;

  // === Domain Age (20%) ===
  let domainAge = 50; // default unknown
  let domainAgeDetail = "Unknown";
  if (domainAgeDays !== null) {
    if (domainAgeDays < 90) { domainAge = 10; domainAgeDetail = "Less than 3 months (very new)"; }
    else if (domainAgeDays < 365) { domainAge = 30; domainAgeDetail = "Less than 1 year"; }
    else if (domainAgeDays < 730) { domainAge = 55; domainAgeDetail = "1-2 years"; }
    else if (domainAgeDays < 1825) { domainAge = 75; domainAgeDetail = "2-5 years"; }
    else if (domainAgeDays < 3650) { domainAge = 90; domainAgeDetail = "5-10 years (established)"; }
    else { domainAge = 98; domainAgeDetail = "10+ years (well-established)"; }
  }
  const domainAgeW = 20;

  // === DNS Health (15%) ===
  let dnsHealth = 30;
  let dnsDetail = "";
  if (hasMX) { dnsHealth += 25; dnsDetail = "MX present"; } else dnsDetail = "No MX";
  if (hasSPF) { dnsHealth += 20; dnsDetail += ", SPF"; }
  if (hasDMARC) { dnsHealth += 20; dnsDetail += ", DMARC"; if (dmarcPolicy === "reject") dnsHealth += 5; }
  if (!hasMX && !hasSPF && !hasDMARC) { dnsHealth = 0; dnsDetail = "No email authentication configured"; }
  const dnsHealthW = 15;

  // === IP Reputation (15%) ===
  let ipRep = 100;
  let ipDetail = "Clean";
  if (isProxy) { ipRep -= 40; ipDetail = "Proxy/VPN detected"; }
  if (isHosting) { ipRep -= 30; ipDetail = "Hosting/datacenter IP"; }
  if (blacklistHits.length > 0) { ipRep -= 50; ipDetail = "IP/domain on blacklist"; }
  if (country && ["NG","RU","IR","KP","VE","SY","SD","CU","PK","KH","BD"].includes(country)) {
    ipRep -= 15; ipDetail += " - high-risk region";
  }
  ipRep = Math.max(0, ipRep);
  const ipRepW = 15;

  // === Company Existence (15%) ===
  let companyExistence = 50;
  let companyDetail = "Unknown (no company data)";
  if (domainAgeDays !== null && domainAgeDays > 1825) {
    companyExistence = 80;
    companyDetail = "Domain active for 5+ years (established business likely)";
  }
  if (hasMX && hasSPF && hasDMARC) {
    companyExistence = Math.min(100, companyExistence + 20);
    companyDetail = "Full email infrastructure (operating business)";
  }
  const companyExistenceW = 15;

  // === Negative Signals (10%) ===
  let negativePenalty = 0;
  let negativeDetail = "None";
  if (isDisposable) { negativePenalty = 100; negativeDetail = "Disposable email"; }
  if (blacklistHits.length > 0) { negativePenalty = Math.max(negativePenalty, 60); negativeDetail = "Blacklisted"; }
  if (isProxy && isHosting) { negativePenalty = Math.max(negativePenalty, 50); negativeDetail = "Hidden identity"; }
  const negativeSignalsW = 10;

  // === Weighted Total ===
  const total = Math.round(
    (emailTrust * emailTrustW +
     domainAge * domainAgeW +
     dnsHealth * dnsHealthW +
     ipRep * ipRepW +
     companyExistence * companyExistenceW -
     negativePenalty * negativeSignalsW / 100 * 100) / 100
  );
  const healthScore = Math.max(0, Math.min(100, total));

  // === Grade ===
  let grade: string, stars: string, label: string, recommendation: string;
  if (healthScore >= 85) {
    grade = "A"; stars = "★★★★★"; label = "Trusted Business";
    recommendation = "Safe for onboarding and sales engagement. Low risk profile.";
  } else if (healthScore >= 70) {
    grade = "B"; stars = "★★★★☆"; label = "Likely Legitimate";
    recommendation = "Proceed with standard verification. Minor risk signals present.";
  } else if (healthScore >= 50) {
    grade = "C"; stars = "★★★☆☆"; label = "Needs Review";
    recommendation = "Manual review recommended before committing resources. Verify company details.";
  } else if (healthScore >= 30) {
    grade = "D"; stars = "★★☆☆☆"; label = "High Risk";
    recommendation = "Significant risk signals detected. Require additional verification before engagement.";
  } else {
    grade = "F"; stars = "★☆☆☆☆"; label = "Do Not Engage";
    recommendation = "Multiple critical risk signals. Do NOT proceed with sales or onboarding.";
  }

  // === Signals ===
  const positiveSignals: string[] = [];
  const riskSignals: string[] = [];

  if (domainAgeDays !== null && domainAgeDays > 1825) positiveSignals.push("Domain active for " + Math.round(domainAgeDays/365) + "+ years");
  if (!isDisposable && hasMX) positiveSignals.push("Corporate email infrastructure detected");
  if (hasSPF) positiveSignals.push("SPF authentication enabled");
  if (hasDMARC) positiveSignals.push("DMARC protection active" + (dmarcPolicy === "reject" ? " (strict policy)" : ""));
  if (blacklistHits.length === 0) positiveSignals.push("No blacklist records found");
  if (!isProxy && !isHosting) positiveSignals.push("Clean IP reputation");

  if (isDisposable) riskSignals.push("Disposable email address — likely fraudulent");
  if (domainAgeDays !== null && domainAgeDays < 90) riskSignals.push("Domain registered less than 3 months ago");
  if (!hasMX) riskSignals.push("No mail server configured — cannot receive email");
  if (!hasSPF) riskSignals.push("Missing SPF — domain vulnerable to spoofing");
  if (blacklistHits.length > 0) riskSignals.push("Found on abuse blacklist (" + blacklistHits.length + " hits)");
  if (isProxy) riskSignals.push("Proxy/VPN detected — identity hidden");
  if (isHosting) riskSignals.push("Datacenter IP — likely automated traffic");
  if (companyExistence < 50) riskSignals.push("Limited company existence signals");

  return {
    healthScore, grade, stars, label, recommendation,
    positiveSignals, riskSignals,
    breakdown: {
      emailTrust: { score: emailTrust, weight: emailTrustW, details: isDisposable ? "Disposable" : riskScore > 70 ? "High risk" : "Trusted" },
      domainAge: { score: domainAge, weight: domainAgeW, details: domainAgeDetail },
      dnsHealth: { score: dnsHealth, weight: dnsHealthW, details: dnsDetail },
      ipReputation: { score: ipRep, weight: ipRepW, details: ipDetail },
      companyExistence: { score: companyExistence, weight: companyExistenceW, details: companyDetail },
      negativeSignals: { penalty: negativePenalty, weight: negativeSignalsW, details: negativeDetail },
    },
  };
}
