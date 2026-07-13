import { reconcileDueCreditCycles } from "@/lib/credit-reconciliation";

export const maxDuration=60;

export async function GET(request:Request) {
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`) {
    return Response.json({error:"Unauthorized"},{status:401});
  }
  try {
    return Response.json(await reconcileDueCreditCycles({now:new Date(),limit:500}));
  } catch(error) {
    console.error("[credit-refresh] failed",error instanceof Error?error.message:"unknown");
    return Response.json({error:"Credit reconciliation failed"},{status:500});
  }
}
