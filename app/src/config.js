// Deployed Ethos contract on GenLayer Testnet Bradbury.
// Baked-in fallback so the hosted site works with no env config; override on
// Netlify via the VITE_CONTRACT_ADDRESS site environment variable.
export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x3Be3c65Ef4E1755D878dD48c39D150De34a4335a";

export const CHAIN_ID = 4221;
export const NETWORK_KEY = "testnetBradbury"; // genlayer-js chain key for connect()
export const EXPLORER = "https://explorer-bradbury.genlayer.com";
export const FAUCET = "https://testnet-faucet.genlayer.foundation";

export const txUrl = (hash) => `${EXPLORER}/tx/${hash}`;
export const addrUrl = (addr) => `${EXPLORER}/address/${addr}`;
export const contractUrl = `${EXPLORER}/contracts/${CONTRACT_ADDRESS}`;

export const short = (a) => (a ? `${a.slice(0, 6)}\u2026${a.slice(-4)}` : "");
export const gen = (atto) => {
  try {
    return (Number(BigInt(atto)) / 1e18).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
  } catch {
    return "0";
  }
};
