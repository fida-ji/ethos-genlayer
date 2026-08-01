import { useCallback, useEffect, useState } from "react";
import { makeWriteClient, ensureNetwork } from "./genlayer.js";
import { CHAIN_ID } from "./config.js";

// Full wallet lifecycle against an injected EIP-1193 provider (e.g. MetaMask).
// No Snaps: the Bradbury chain is switched/added directly via genlayer-js.
export function useWallet() {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [client, setClient] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const provider = typeof window !== "undefined" ? window.ethereum : undefined;
  const onRightChain = chainId === CHAIN_ID;

  const bind = useCallback(
    (addr) => {
      if (!provider || !addr) {
        setClient(null);
        return null;
      }
      const c = makeWriteClient(addr, provider);
      setClient(c);
      return c;
    },
    [provider]
  );

  const refreshChain = useCallback(async () => {
    if (!provider) return;
    try {
      const idHex = await provider.request({ method: "eth_chainId" });
      setChainId(parseInt(idHex, 16));
    } catch {
      /* ignore */
    }
  }, [provider]);

  const connect = useCallback(async () => {
    setError(null);
    if (!provider) {
      setError("No Ethereum wallet found. Install MetaMask to sign transactions.");
      return;
    }
    setConnecting(true);
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const addr = accounts?.[0] || null;
      setAddress(addr);
      const c = bind(addr);
      if (c) {
        // Switch/add Bradbury directly (adds the chain if the wallet lacks it).
        await ensureNetwork(c);
      }
      await refreshChain();
    } catch (e) {
      setError(e?.message || "Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  }, [provider, bind, refreshChain]);

  const switchNetwork = useCallback(async () => {
    if (!client) return;
    setError(null);
    try {
      await ensureNetwork(client);
      await refreshChain();
    } catch (e) {
      setError(e?.message || "Failed to switch network");
    }
  }, [client, refreshChain]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setClient(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!provider) return;
    const onAccounts = (accts) => {
      const addr = accts?.[0] || null;
      setAddress(addr);
      if (addr) bind(addr);
      else setClient(null);
    };
    const onChain = (idHex) => setChainId(parseInt(idHex, 16));
    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    // Reflect an already-authorized session without prompting.
    provider
      .request({ method: "eth_accounts" })
      .then((a) => {
        if (a?.[0]) {
          setAddress(a[0]);
          bind(a[0]);
        }
      })
      .catch(() => {});
    refreshChain();
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider, bind, refreshChain]);

  return {
    address,
    chainId,
    client,
    connecting,
    error,
    connect,
    disconnect,
    switchNetwork,
    onRightChain,
    hasProvider: !!provider,
  };
}
