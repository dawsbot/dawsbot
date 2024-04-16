export async function generateHtml(username: string, duneApiKey: string) {
  console.log("fetching tips from dune...");
  const tips = await fetchValidTips(username, duneApiKey);
  console.dir({ tips });
  console.log("fetching photo urls from neynar...");
  const profilePhotos = await fetchProfilePhotoUrls(
    tips.map((tip) => tip.wallet_address)
  );
  console.dir({ profilePhotos });

  return tips
    .map((tip) => {
      return `<a href="https://warpcast.com/${tip.fname}"><img src="${
        profilePhotos[tip.wallet_address]
      }" width="60px" alt="${tip.display_name}" /></a>`;
    })
    .join("");
}

import { Dune } from "dune-api-client";
import omit from "just-omit";
import { z } from "zod";

// https://dune.com/queries/3626954/6109458
const QUERY_ID = 3626954;
const NEYNAR_API_KEY = z.string().parse(process.env.NEYNAR_API_KEY);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export const fetchValidTips = async (username: string, duneApiKey: string) => {
  const dune = new Dune(duneApiKey);
  const execute = await dune.execute(QUERY_ID, {
    params: { username },
  });
  let state: string;
  do {
    await sleep(1_500);
    state = (await dune.status(execute.execution_id)).state;
  } while (
    state === "QUERY_STATE_PENDING" ||
    state === "QUERY_STATE_EXECUTING"
  );
  const duneResult = await dune
    .results(execute.execution_id)
    .then((res) => duneResultSchema.parse(res.result));
  const tips = duneResult.rows;
  let validTips = tips
    .filter((tip) => {
      return tip.valid_tip === "✅";
    })
    .map((validTip) => {
      return omit(validTip, "valid_tip");
    });
  const totalTipAmountByRecipient = validTips.reduce((acc, tip) => {
    const recipientAddress = tip.wallet_address;
    if (!acc[recipientAddress]) {
      acc[recipientAddress] = 0;
    }
    acc[recipientAddress] += tip.actual_tip_amount;
    return acc;
  }, {} as Record<string, number>);

  validTips = validTips
    .sort((validTipA, validTipB) => {
      return (
        totalTipAmountByRecipient[validTipB.wallet_address] -
        totalTipAmountByRecipient[validTipA.wallet_address]
      );
    })
    .filter((tip) => {
      // remove tips which have a duplicate wallet_address
      return (
        tip.wallet_address !==
        validTips[validTips.indexOf(tip) - 1]?.wallet_address
      );
    });

  return validTips;
};

export async function fetchProfilePhotoUrls(
  addresses: string[]
): Promise<Record<string, string>> {
  const res = await fetch(
    `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${addresses.join(
      "%2C"
    )}`,
    {
      headers: {
        api_key: NEYNAR_API_KEY,
      },
    }
  )
    .then((res) => res.json())
    .then((res) => neynarResultSchema.parse(res));

  let addressImageMapping: Record<string, string> = {};

  const DEFAULT_PFP =
    "https://assets.coingecko.com/coins/images/34515/large/android-chrome-512x512.png";
  Object.entries(res).forEach(([ethAddress, values]) => {
    const pfpUrl =
      values.find((value) => typeof value.pfp_url === "string")?.pfp_url ||
      DEFAULT_PFP;
    addressImageMapping[ethAddress] = pfpUrl;
  });

  return addressImageMapping;
}
const duneResultSchema = z.object({
  rows: z.array(
    z.object({
      //   accumulated_points: z.number(),
      //   avatar_url: z.string(),
      actual_tip_amount: z.number(),
      //   cast_hash: z.string(),
      //   cast_link: z.string(),
      //   channel_boost: z.string(),
      //   day: z.string(),
      display_name: z.string(),
      //   donated_amount: z.number(),
      //   donor_fid: z.number(),
      //   donor_tip_allowance: z.number(),
      //   event_day: z.string(),
      fname: z.string(),
      //   mgt_display_name: z.string(),
      //   mgt_fid: z.number(),
      //   mgt_fname: z.string(),
      //   mgt_tip_count: z.number(),
      //   mgt_total_tip_amount: z.number(),
      //   mta_cast: z.string(),
      //   mta_cast_link: z.string(),
      //   mta_parent_hash: z.string(),
      //   mta_tip_count: z.number(),
      //   mta_total_tip_amount: z.number(),
      //   mtc_cast: z.string(),
      //   mtc_cast_link: z.string(),
      //   mtc_parent_hash: z.string(),
      //   mtc_tip_count: z.number(),
      //   mtc_total_tip_amount: z.number(),
      //   parent_hash: z.string(),
      //   recipient_fid: z.number(),
      //   recipient_name: z.string(),
      timestamp: z.string(),
      //   tip_amount: z.number(),
      valid_tip: z.string(),
      wallet_address: z.string(),
    })
  ),
});

export const neynarResultSchema = z.record(
  z.string(),
  z.array(
    z.object({
      pfp_url: z.union([z.string(), z.null()]),
    })
  )
);
