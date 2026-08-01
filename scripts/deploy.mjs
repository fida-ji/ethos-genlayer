// Deploy the Ethos contract to GenLayer Testnet Bradbury and verify it live.
import { writeFileSync } from "node:fs";
import { TransactionStatus } from "genlayer-js/types";
import {
  makeClient,
  readContractCode,
  withRetry,
  txUrl,
  EXPLORER,
  DEPLOYMENT_PATH,
} from "./lib.mjs";

function extractAddress(receipt) {
  return (
    receipt?.data?.contract_address ||
    receipt?.txDataDecoded?.contractAddress ||
    receipt?.contractAddress ||
    receipt?.deployedContractAddress ||
    null
  );
}

async function main() {
  const feeRecipient = process.env.FEE_RECIPIENT || "";
  const feeBps = Number(process.env.FEE_BPS || "100");

  const { client, account } = makeClient();
  console.log("Deployer:", account.address);
  console.log("Network:  Testnet Bradbury (chainId 4221)");
  console.log("Fee bps:  ", feeBps, feeRecipient ? `-> ${feeRecipient}` : "-> deployer");

  await withRetry("initializeConsensus", () => client.initializeConsensusSmartContract());

  const code = readContractCode();
  console.log("\nDeploying contracts/ethos.py ...");
  const txHash = await withRetry("deployContract", () =>
    client.deployContract({ code, args: [feeRecipient, feeBps] })
  );
  console.log("Deploy tx:", txHash);
  console.log("           " + txUrl(txHash));

  const receipt = await withRetry("waitForReceipt", () =>
    client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.ACCEPTED,
      retries: 300,
      interval: 5000,
    })
  );

  const address = extractAddress(receipt);
  if (!address) {
    console.error("Could not extract contract address. Receipt keys:", Object.keys(receipt || {}));
    console.error(JSON.stringify(receipt, (k, v) => (typeof v === "bigint" ? v.toString() : v)).slice(0, 2000));
    throw new Error("Deployment did not yield a contract address");
  }
  console.log("\nContract address:", address);

  // Verify live: read a view method back from the chain (do not trust ACCEPTED alone).
  const config = await withRetry("get_config", () =>
    client.readContract({ address, functionName: "get_config", args: [] })
  );
  const stats = await withRetry("get_stats", () =>
    client.readContract({ address, functionName: "get_stats", args: [] })
  );
  console.log("Live get_config():", config);
  console.log("Live get_stats():", stats);

  const out = {
    network: "testnet-bradbury",
    chainId: 4221,
    address,
    deployTx: txHash,
    deployTxUrl: txUrl(txHash),
    contractUrl: `${EXPLORER}/contracts/${address}`,
    deployer: account.address,
    feeBps,
    deployedAt: new Date().toISOString(),
  };
  writeFileSync(DEPLOYMENT_PATH, JSON.stringify(out, null, 2));
  console.log("\nWrote deployment.json");
  console.log("Verified live via get_config read. Deploy complete.");
}

main().catch((e) => {
  console.error("DEPLOY FAILED:", e?.message || e);
  process.exit(1);
});
