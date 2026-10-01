import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

function isReachable(state: Network.NetworkState): boolean {
  return !!(state.isConnected && state.isInternetReachable !== false);
}

export function useNetworkState(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;

    Network.getNetworkStateAsync().then((state) => {
      if (mounted) setOnline(isReachable(state));
    });

    const sub = Network.addNetworkStateListener((state) => {
      setOnline(isReachable(state));
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return online;
}
