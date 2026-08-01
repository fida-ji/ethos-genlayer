// Read live Ethos state from Testnet Bradbury to confirm the deployment.
import { readFileSync } from "node:fs";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { DEPLOYMENT_PATH } from "./lib.mjs";

const address = JSON.parse(readFileSync(DEPLOYMENT_PATH, "utf-8")).address;
const client = createClient({ chain: testnetBradbury });
const call = (fn, args = []) => client.readContract({ address, functionName: fn, args });

const config = await call("get_config");
const stats = await call("get_stats");
const licenses = await call("list_licenses");

console.log("Contract:", address);
console.log("Config:  ", config);
console.log("Stats:   ", stats);
console.log("Licenses:");
for (const l of licenses) {
  console.log(
    `  - ${l.id.padEnd(16)} verdict=${l.last_verdict.padEnd(10)} ` +
      `sev=${l.last_severity} strikes=${l.strikes}/${l.strike_threshold} ` +
      `active=${l.active} slashed=${(Number(BigInt(l.slashed_atto)) / 1e18).toFixed(3)}GEN`
  );
}
