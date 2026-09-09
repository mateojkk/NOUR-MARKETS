import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  return res.status(200).json({
    status: "ok",
    platform: "Nour Prediction Markets",
    network: "Somnia Shannon Testnet",
    chainId: 50312,
    coreContracts: {
      binaryMarketsModule: "0x3ecC694Cef705358864a646142ac17A90E29e388",
      binarySettlement: "0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23",
      outcomeToken6909: "0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9",
      oracleHub: "0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b",
      collateral: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
    },
    timestamp: new Date().toISOString(),
  });
}
