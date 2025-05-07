import { humanToBase } from "../src/utils/decimals";
import {
  USDT_DECIMALS,
  ETH_DECIMALS,
  BTC_DECIMALS
} from "../src/utils/constants";

describe("humanToBase", () => {
  it("converts 15 USDT ⇒ 15000000", () => {
    expect(humanToBase("15", USDT_DECIMALS)).toBe("15000000");
  });
  it("converts 1.234 ETH ⇒ 1234000000000000000", () => {
    expect(humanToBase("1.234", ETH_DECIMALS)).toBe(
      "1234000000000000000"
    );
  });
  it("converts 0.00000001 BTC ⇒ 1 satoshi", () => {
    expect(humanToBase("0.00000001", BTC_DECIMALS)).toBe("1");
  });
});
