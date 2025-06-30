// tests/payment.integration.test.ts
import { POST as initiate } from "../src/app/api/payment/initiate/route";
import { GET as status } from "../src/app/api/payment/status/route";
import { supabase } from "../src/lib/supabaseClient";
import { NextRequest } from "next/server";

describe("🚀 Payment gateway integration", () => {
  let orderId: string;

  beforeAll(async () => {
    // 1) Create a table row so initiate can update it
    const { data, error } = await supabase
      .from("table")
      .insert([
        {
          user_id: "test-user",
          client_id: "test-client",
          location_country: "TestLand",
          package: "lite",
          addons: [],
          contact_full_name: "Tester",
          contact_title: null,
          contact_company: null,
          contact_email: "test@example.com",
          contact_phone: null,
          payment_status: "unpaid",
          total_due: 0,
        },
      ])
      .select("id")
      .single();

    if (error || !data) throw new Error("Could not insert test order: " + error?.message);
    orderId = data.id;
  });

  it("should initiate a USDT/ERC-20 payment and return depositAddress + expiresAt", async () => {
    const body = JSON.stringify({
      orderId,
      currency: "usdt",
      network: "erc20",
      amountDue:  "15", // 15 USDT
    });

    const req = new NextRequest("http://localhost/api/payment/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const res = await initiate(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.orderId).toBe(orderId);
    expect(typeof json.depositAddress).toBe("string");
    expect(typeof json.expiresAt).toBe("number");

    // DB should now have payment_status = "pending"
    const { data: updated } = await supabase
      .from("table")
      .select("payment_status")
      .eq("id", orderId)
      .single();
    expect(updated?.payment_status).toBe("pending");
  });

  it("should initially report confirmed=false, then confirmed=true after marking paid", async () => {
    // 1) call status → should be pending / confirmed: false
    const req1 = new NextRequest(
      `http://localhost/api/payment/status?orderId=${orderId}`
    );
    const res1 = await status(req1);
    expect(res1.status).toBe(200);

    const json1 = await res1.json();
    expect(json1.confirmed).toBe(false);

    // 2) simulate on‐chain capture by marking row paid
    const { error } = await supabase
      .from("table")
      .update({ payment_status: "paid" })
      .eq("id", orderId);
    if (error) throw new Error("Failed to simulate payment: " + error.message);

    // 3) call status again → confirmed: true
    const res2 = await status(req1);
    expect(res2.status).toBe(200);

    const json2 = await res2.json();
    expect(json2.confirmed).toBe(true);
  });
});
