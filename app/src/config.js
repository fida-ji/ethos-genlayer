// Deployed Ethos contract on GenLayer Testnet Bradbury.
// Baked-in fallback so the hosted site works with no env config; override on
// Netlify via the VITE_CONTRACT_ADDRESS site environment variable.
export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x3Be3c65Ef4E1755D878dD48c39D150De34a4335a";

export const CHAIN_ID = 4221;
export const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;
// Bradbury RPC. The Bradbury server rejects string JSON-RPC ids (which MetaMask
// sends), so browser writes route through an id-normalizing proxy. Reads still
// use the direct RPC. Override the proxy URL via VITE_BRADBURY_RPC_PROXY.
export const RPC_DIRECT = "https://rpc-bradbury.genlayer.com";
export const RPC_PROXY =
  import.meta.env.VITE_BRADBURY_RPC_PROXY ||
  "https://ethos-bradbury-rpc-proxy.ethos-genlayer.workers.dev";
// Chain params MetaMask uses: the proxy URL, so wallet writes succeed.
export const CHAIN_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "GenLayer Testnet Bradbury",
  rpcUrls: [RPC_PROXY],
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  blockExplorerUrls: ["https://explorer-bradbury.genlayer.com"],
};
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
