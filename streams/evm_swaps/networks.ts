import {
  AERODROME_BASIC_DEPLOYMENTS,
  AERODROME_SLIPSTREAM_DEPLOYMENTS,
  UNISWAP_V2_DEPLOYMENTS,
  UNISWAP_V3_DEPLOYMENTS,
} from './deployments';
import { events as UniswapV3FactoryEvents } from './uniswap.v3/factory';
import { events as UniswapV3SwapEvents } from './uniswap.v3/swaps';
import { events as UniswapV2FactoryEvents } from './uniswap.v2/factory';
import { events as UniswapV2SwapEvents } from './uniswap.v2/swaps';
import { events as AerodromeBasicFactoryEvents } from './aerodrome.basic/factory';
import { events as AerodromeBasicSwapEvents } from './aerodrome.basic/swaps';
import { events as AerodromeSlipstreamFactoryEvents } from './aerodrome.slipstream/factory';
import { events as AerodromeSlipstreamSwapEvents } from './aerodrome.slipstream/swaps';
import { DexProtocol } from './swap_types';

export type Network = 'base' | 'ethereum';

export const NetworksMappings: Record<
  Network,
  Partial<Record<DexProtocol, { pools: any; swaps: any }>>
> = {
  ethereum: {
    uniswap_v3: {
      pools: {
        address: [UNISWAP_V3_DEPLOYMENTS['ethereum']!.Factory],
        topic0: [UniswapV3FactoryEvents.PoolCreated.topic],
        transaction: true,
      },
      swaps: [
        {
          topic0: [UniswapV3SwapEvents.Swap.topic],
          transaction: true,
        },
      ],
    },
  },
  base: {
    uniswap_v3: {
      pools: {
        address: [UNISWAP_V3_DEPLOYMENTS['base']!.Factory],
        topic0: [UniswapV3FactoryEvents.PoolCreated.topic],
        transaction: true,
      },
      swaps: {
        topic0: [UniswapV3SwapEvents.Swap.topic],
        transaction: true,
      },
    },
    uniswap_v2: {
      pools: {
        address: [UNISWAP_V2_DEPLOYMENTS['base']!.Factory],
        topic0: [UniswapV2FactoryEvents.PairCreated.topic],
        transaction: true,
      },
      swaps: {
        topic0: [UniswapV2SwapEvents.Swap.topic],
        transaction: true,
      },
    },
    aerodrome_basic: {
      pools: {
        address: [AERODROME_BASIC_DEPLOYMENTS['base']!.Factory],
        topic0: [AerodromeBasicFactoryEvents.PoolCreated.topic],
        transaction: true,
      },
      swaps: {
        topic0: [AerodromeBasicSwapEvents.Swap.topic],
        transaction: true,
      },
    },
    aerodrome_slipstream: {
      pools: {
        address: [AERODROME_SLIPSTREAM_DEPLOYMENTS['base']!.Factory],
        topic0: [AerodromeSlipstreamFactoryEvents.PoolCreated.topic],
        transaction: true,
      },
      swaps: {
        topic0: [AerodromeSlipstreamSwapEvents.Swap.topic],
        transaction: true,
      },
    },
  },
};

export const MulticallAddresses: Record<Network, string> = {
  ethereum: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
  base: '0xcA11bde05977b3631167028862bE2a173976CA11',
};
