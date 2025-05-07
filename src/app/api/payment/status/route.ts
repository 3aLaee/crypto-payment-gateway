import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { getProvider } from "@/utils/getProvider";
import { Interface, id, zeroPadValue } from "ethers";

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId missing" }, { status: 400 });
  }

  const { data: order, error } = await supabase
    .from("press_releases")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // still initializing?
  if (!order.deposit_address) {
    return NextResponse.json(
      { error: "No deposit_address yet; retry" },
      { status: 202 }
    );
  }

  let confirmed = false;

  if (order.currency === "btc") {
    // Blockstream TX scan
    const txs = await fetch(
      `https://blockstream.info/api/address/${order.deposit_address}/txs/chain`
    ).then(r => r.json());
    confirmed = txs.some((tx: any) =>
      tx.status.confirmed &&
      tx.vout.some((o: any) =>
        o.scriptpubkey_address === order.deposit_address &&
        o.value === Number(order.total_due)
      )
    );

  } else {
    const provider = await getProvider();

    if (order.currency === "eth") {
      const bal = await provider.getBalance(order.deposit_address);
      confirmed =
        bal > BigInt(order.start_balance) + BigInt(order.total_due);

    } else {
      // USDT
      const iface = new Interface([
        "event Transfer(address indexed from,address indexed to,uint256 value)"
      ]);
      const transferTopic = id("Transfer(address,address,uint256)");
      const toTopic = zeroPadValue(
        order.deposit_address.toLowerCase(),
        32
      );

      const logs = await provider.getLogs({
        fromBlock: order.start_block,
        toBlock: "latest",
        address: process.env.USDT_CONTRACT_ADDRESS,
        topics: [transferTopic, null, toTopic]
      });

      confirmed = logs.some(log => {
        const parsed = iface.parseLog(log);
        return (parsed.args[2] as bigint) === BigInt(order.total_due);
      });
    }
  }

  if (confirmed) {
    await supabase
      .from("press_releases")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString()
      })
      .eq("id", orderId);
  }

  return NextResponse.json({ confirmed });
}
