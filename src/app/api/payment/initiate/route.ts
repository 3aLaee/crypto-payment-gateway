import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { getProvider } from "@/utils/getProvider";
import { humanToBase } from "@/utils/decimals";
import {
  USDT_DECIMALS,
  ETH_DECIMALS,
  BTC_DECIMALS
} from "@/utils/constants";
import { Contract } from "ethers";

const ADDRESSES: Record<string, string[]> = {
  btc: process.env.BTC_ADDRESSES!.split(","),
  eth: process.env.ETH_ADDRESSES!.split(","),
  usdt: process.env.USDT_ADDRESSES!.split(",")
};

export async function POST(req: NextRequest) {
  const { orderId, currency, network, amountDue } = await req.json();
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  // convert human to base units
  let amountRaw: string;
  if (currency === "btc") {
    amountRaw = humanToBase(amountDue, BTC_DECIMALS);
  } else if (currency === "eth") {
    amountRaw = humanToBase(amountDue, ETH_DECIMALS);
  } else {
    amountRaw = humanToBase(amountDue, USDT_DECIMALS);
  }

  // choose the less-used address (simple 2-pool)
  const pool = ADDRESSES[currency];
  if (!pool) {
    return NextResponse.json({ error: "Unknown currency" }, { status: 400 });
  }
  const counts = await Promise.all(
    pool.map(addr =>
      supabase
        .from("press_releases")
        .select("*", { count: "exact" })
        .eq("deposit_address", addr)
        .neq("payment_status", "paid")
        .then(r => r.count || 0)
    )
  );
  const idx = counts[0] <= counts[1] ? 0 : 1;
  const deposit_address = pool[idx];

  // fetch start_block & start_balance
  let start_block: number;
  let start_balance = "0";

  if (currency === "btc") {
    const res = await fetch("https://blockstream.info/api/blocks/tip/height");
    start_block = Number(await res.text());
  } else {
    const provider = await getProvider();
    start_block = await provider.getBlockNumber();

    if (currency === "eth") {
      start_balance = (await provider.getBalance(deposit_address)).toString();
    } else {
      // USDT
      const abi = ["function balanceOf(address) view returns (uint256)"];
      const c = new Contract(
        process.env.USDT_CONTRACT_ADDRESS!,
        abi,
        provider
      );
      start_balance = (await c.balanceOf(deposit_address)).toString();
    }
  }

  // update row
  const { data, error } = await supabase
    .from("press_releases")
    .update({
      currency,
      network,
      total_due: amountRaw,
      deposit_address,
      start_block,
      start_balance,
      payment_status: "pending"
    })
    .eq("id", orderId)
    .select("id")
    .single();

  if (error || !data) {
    console.error("initiate error:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }

  const expiresAt = Date.now() + 30 * 60_000;
  return NextResponse.json({
    orderId: data.id,
    depositAddress: deposit_address,
    expiresAt
  });
}
