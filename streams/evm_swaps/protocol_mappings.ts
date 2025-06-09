import { DecodedEvmSwap } from './swap_types';

import { PoolMetadata, PoolMetadataSimple } from './pool_metadata_storage';
import { DexName, Network, NetworksMappings } from './networks';
import { EventRecord } from '@subsquid/evm-abi';

export const findSwap = (log: any, poolMetadata: PoolMetadata): DecodedEvmSwap | null => {
  const networkConfig = NetworksMappings[poolMetadata.network];
  if (!networkConfig) {
    return null;
  }

  const dex = networkConfig[poolMetadata.dex_name];
  if (!dex) {
    return null;
  }

  const protocol = dex[poolMetadata.protocol];
  if (!protocol) {
    return null;
  }

  if (protocol.swapEvent.is(log)) {
    return protocol.swapHandler(log);
  }

  return null;
};

export const findPoolMetadata = (l: any, block: any, network: Network): PoolMetadata | null => {
  const networkConfig = NetworksMappings[network];
  if (!networkConfig) {
    return null;
  }

  for (const [dexName, dexConfig] of Object.entries(networkConfig)) {
    for (const [protocolName, protocolConfig] of Object.entries(dexConfig)) {
      if (protocolConfig.factoryAddress === l.address.toLowerCase()) {
        const mdSimple = protocolConfig.poolCreateHandler(l, block);
        if (mdSimple) {
          return { ...mdSimple, dex_name: dexName as DexName, network };
        }
      }
    }
  }

  return null;
};
