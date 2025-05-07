import { JsonRpcProvider } from "ethers";

export async function getProvider(): Promise<JsonRpcProvider> {
  const urls = [
    process.env.ETH_RPC_URL!,
    process.env.ETH_FALLBACK_RPC_URL!
  ];
  for (const url of urls) {
    try {
      const p = new JsonRpcProvider(url);
      await p.getBlockNumber();
      return p;
    } catch {
      console.warn(`RPC ${url} failed, trying next…`);
    }
  }
  throw new Error("All Ethereum RPC endpoints failed");
}
