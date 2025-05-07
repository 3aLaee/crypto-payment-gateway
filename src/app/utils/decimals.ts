import { parseUnits } from "ethers";

export function humanToBase(
  amount: string | number,
  decimals: number
): string {
  if (decimals === 8) {
    // BTC: no parseUnits, just integer satoshis
    const n = typeof amount === "number" ? amount : parseFloat(amount);
    return BigInt(Math.floor(n * 10 ** 8)).toString();
  } else {
    // ETH / ERC-20
    return parseUnits(amount.toString(), decimals).toString();
  }
}
