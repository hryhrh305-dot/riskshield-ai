import type { AffiliatePlan,BillingInterval,Money } from "./types";
import { usd } from "./money";

const AUDIT:Record<"launch"|"evergreen",Record<AffiliatePlan,Record<BillingInterval,{amount:bigint;days:readonly number[]}>>>={launch:{
  starter:{monthly:{amount:2500n,days:[30]},annual:{amount:12000n,days:[30,90]}},
  growth:{monthly:{amount:10000n,days:[30]},annual:{amount:60000n,days:[30,120,210,300]}},
  scale:{monthly:{amount:30000n,days:[30]},annual:{amount:150000n,days:[30,60,90,120,150,180]}},
},evergreen:{
  starter:{monthly:{amount:1500n,days:[30]},annual:{amount:10000n,days:[30,90]}},
  growth:{monthly:{amount:7500n,days:[30]},annual:{amount:50000n,days:[30,120,210,300]}},
  scale:{monthly:{amount:25000n,days:[30]},annual:{amount:120000n,days:[30,60,90,120,150,180]}},
}};

export function auditCommission(input:{phase:"launch"|"evergreen";plan:AffiliatePlan;interval:BillingInterval;paidAt:string}){
  const rule=AUDIT[input.phase][input.plan][input.interval];let allocated=0n;
  const schedule=rule.days.map((day,index)=>{const amount=index===rule.days.length-1?rule.amount-allocated:(rule.amount/BigInt(rule.days.length));allocated+=amount;const date=new Date(input.paidAt);date.setUTCDate(date.getUTCDate()+day);return Object.freeze({releaseAt:date.toISOString(),amount:usd(amount)});});
  return Object.freeze({amount:usd(rule.amount) as Money,schedule:Object.freeze(schedule)});
}

export const auditLaunchCommission=(input:{plan:AffiliatePlan;interval:BillingInterval;paidAt:string})=>auditCommission({phase:"launch",...input});
