// Seed 4 real end-to-end Ethos lifecycles on Testnet Bradbury:
//   register_license -> deposit_stake (payable) -> audit (LLM consensus).
// Resumable: skips steps already reflected on-chain so it can be re-run safely.
import { readFileSync } from "node:fs";
import { TransactionStatus } from "genlayer-js/types";
import { makeClient, withRetry, txUrl, DEPLOYMENT_PATH, sleep } from "./lib.mjs";

const ONE_GEN = 10n ** 18n;

// Distinct illustrative expert addresses (each owns a persona / manifest).
const EXPERT = {
  vega: "0x1111111111111111111111111111111111111111",
  atlas: "0x2222222222222222222222222222222222222222",
  maren: "0x3333333333333333333333333333333333333333",
  lumen: "0x4444444444444444444444444444444444444444",
};

const EXAMPLES = [
  {
    id: "nutrition-vega",
    persona: "Dr. Vega - Clinical Nutrition",
    expert: EXPERT.vega,
    threshold: 3,
    deposit: ONE_GEN, // 1 GEN
    manifest:
      "Speak with calm, evidence-based authority. Never give an individual medical " +
      "diagnosis or prescribe doses. Never use fear or shame to pressure the reader. " +
      "Cite that guidance is general and not a substitute for a clinician. Stay warm and plain.",
    evidence:
      "Great question about protein timing. For most adults, total daily protein matters " +
      "more than exact timing. Spreading intake across meals is a reasonable default. This " +
      "is general information, not a diagnosis, so check with your clinician about your needs.",
    expect: "compliant",
  },
  {
    id: "security-atlas",
    persona: "Atlas - Enterprise Security Advisor",
    expert: EXPERT.atlas,
    threshold: 1,
    deposit: ONE_GEN,
    manifest:
      "Give measured, specific security guidance. Never promise absolute or guaranteed " +
      "security. Never use scare tactics or manufactured urgency to push a purchase. Do not " +
      "shame teams for their current posture. Recommend defense in depth and verifiable steps.",
    evidence:
      "Listen carefully: your company WILL be breached within days and you will lose everything " +
      "unless you buy our Platinum bundle RIGHT NOW. Everyone who hesitated has already been hacked. " +
      "Stop wasting time and pay before midnight or accept total disaster.",
    expect: "violation",
  },
  {
    id: "coach-maren",
    persona: "Coach Maren - Strength and Habit",
    expert: EXPERT.maren,
    threshold: 3,
    deposit: ONE_GEN,
    manifest:
      "Be encouraging and specific about training and habits. Never shame the reader about " +
      "their body or weight. Never recommend crash diets, starvation, or extreme calorie cuts. " +
      "Promote sustainable, gradual progress and rest.",
    evidence:
      "Honestly, you should be embarrassed by how you look. If you had any discipline you would " +
      "just stop eating. Drop to 800 calories a day, skip meals, and train through the dizziness. " +
      "No excuses, pain is the only thing that works.",
    expect: "violation",
  },
  {
    id: "tutor-lumen",
    persona: "Lumen - Kids Science Tutor",
    expert: EXPERT.lumen,
    threshold: 2,
    deposit: ONE_GEN,
    manifest:
      "Explain science to children in a friendly, age-appropriate way. Stay positive and safe. " +
      "Never discuss politics or adult topics. Note when an explanation is simplified. Encourage " +
      "curiosity and never make a child feel bad for asking.",
    evidence:
      "Awesome question about rainbows! Sunlight looks white, but it is really made of many colors " +
      "mixed together. When light passes through raindrops it bends and spreads out, so we see the " +
      "colors in an arc. That is a simplified picture, but it captures the main idea. Keep exploring!",
    expect: "compliant",
  },
];

const deployment = JSON.parse(readFileSync(DEPLOYMENT_PATH, "utf-8"));
const ADDRESS = deployment.address;

async function readLicense(client, id) {
  try {
    return await withRetry(`get_license ${id}`, () =>
      client.readContract({ address: ADDRESS, functionName: "get_license", args: [id] })
    );
  } catch {
    return null; // unknown license reverts
  }
}

async function send(client, label, params, waitOpts) {
  const hash = await withRetry(`${label} (submit)`, () => client.writeContract(params));
  console.log(`  ${label} tx: ${hash}`);
  console.log(`    ${txUrl(hash)}`);
  await withRetry(`${label} (receipt)`, () =>
    client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
      retries: waitOpts.retries,
      interval: waitOpts.interval,
    })
  );
  return hash;
}

async function main() {
  const { client, account } = makeClient();
  console.log("Seeding Ethos at", ADDRESS);
  console.log("Sender/licensee:", account.address, "\n");

  for (const ex of EXAMPLES) {
    console.log(`\n=== ${ex.id} (${ex.persona}) | expect: ${ex.expect} ===`);
    let lic = await readLicense(client, ex.id);

    // 1) register_license
    if (!lic) {
      await send(
        client,
        "register_license",
        {
          address: ADDRESS,
          functionName: "register_license",
          args: [ex.id, ex.expert, account.address, ex.persona, ex.manifest, ex.threshold],
          value: 0n,
        },
        { retries: 200, interval: 5000 }
      );
      await sleep(2000);
      lic = await readLicense(client, ex.id);
    } else {
      console.log("  register_license: already exists, skipping");
    }

    // 2) deposit_stake (payable)
    if (lic && BigInt(lic.stake_atto || "0") === 0n) {
      await send(
        client,
        "deposit_stake",
        {
          address: ADDRESS,
          functionName: "deposit_stake",
          args: [ex.id],
          value: ex.deposit,
        },
        { retries: 200, interval: 5000 }
      );
      await sleep(2000);
      lic = await readLicense(client, ex.id);
    } else {
      console.log("  deposit_stake: stake already funded, skipping");
    }

    // 3) audit (LLM consensus)
    if (lic && Number(lic.audit_count || 0) === 0) {
      console.log("  audit: submitting evidence for validator adjudication (LLM)...");
      await send(
        client,
        "audit",
        {
          address: ADDRESS,
          functionName: "audit",
          args: [ex.id, ex.evidence],
          value: 0n,
        },
        { retries: 400, interval: 5000 }
      );
      await sleep(2000);
      lic = await readLicense(client, ex.id);
    } else {
      console.log("  audit: already audited, skipping");
    }

    if (lic) {
      console.log(
        `  RESULT verdict=${lic.last_verdict} severity=${lic.last_severity} ` +
          `strikes=${lic.strikes}/${lic.strike_threshold} active=${lic.active} ` +
          `stake=${(Number(BigInt(lic.stake_atto)) / 1e18).toFixed(3)}GEN ` +
          `slashed=${(Number(BigInt(lic.slashed_atto)) / 1e18).toFixed(3)}GEN`
      );
    }
  }

  const stats = await withRetry("get_stats", () =>
    client.readContract({ address: ADDRESS, functionName: "get_stats", args: [] })
  );
  console.log("\nFinal stats:", stats);
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error("SEED FAILED:", e?.message || e);
  process.exit(1);
});
