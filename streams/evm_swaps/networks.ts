import { events as UniswapV3FactoryEvents } from './uniswap.v3/factory';
import { events as UniswapV3SwapEvents } from './uniswap.v3/swaps';
import { events as UniswapV2FactoryEvents } from './uniswap.v2/factory';
import { events as UniswapV2SwapEvents } from './uniswap.v2/swaps';
import { events as AerodromeBasicFactoryEvents } from './aerodrome.basic/factory';
import { events as AerodromeBasicSwapEvents } from './aerodrome.basic/swaps';
import { events as AerodromeSlipstreamFactoryEvents } from './aerodrome.slipstream/factory';
import { events as AerodromeSlipstreamSwapEvents } from './aerodrome.slipstream/swaps';

export type Network = 'base' | 'ethereum';

export const AllDexProtocols = [
  'uniswap_v3',
  'uniswap_v2',
  'aerodrome_basic',
  'aerodrome_slipstream',
] as const;

export type DexProtocol = (typeof AllDexProtocols)[number];
export type DexName = 'uniswap' | 'aerodrome';

export const NetworksMappings: Record<
  Network,
  Partial<Record<DexName, Partial<Record<DexProtocol, { pools: any; swaps: any }>>>>
> = {
  ethereum: {
    uniswap: {
      uniswap_v2: {
        pools: {
          address: ['0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'.toLowerCase()], // block 10000835
          topic0: [UniswapV2FactoryEvents.PairCreated.topic],
          transaction: true,
        },
        swaps: {
          topic0: [UniswapV2SwapEvents.Swap.topic],
          transaction: true,
        },
      },
      uniswap_v3: {
        pools: {
          address: ['0x1f98431c8ad98523631ae4a59f267346ea31f984'.toLowerCase()],
          topic0: [UniswapV3FactoryEvents.PoolCreated.topic],
          transaction: true,
        },
        swaps: {
          topic0: [UniswapV3SwapEvents.Swap.topic],
          transaction: true,
        },
      },
    },
  },
  base: {
    uniswap: {
      uniswap_v3: {
        pools: {
          address: ['0x33128a8fc17869897dce68ed026d694621f6fdfd'.toLowerCase()], // deployed block 1_371_680
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
          address: ['0x8909dc15e40173ff4699343b6eb8132c65e18ec6'.toLowerCase()], // deployed block 6_601_915
          topic0: [UniswapV2FactoryEvents.PairCreated.topic],
          transaction: true,
        },
        swaps: {
          topic0: [UniswapV2SwapEvents.Swap.topic],
          transaction: true,
        },
      },
    },

    aerodrome: {
      aerodrome_basic: {
        pools: {
          address: ['0x420dd381b31aef6683db6b902084cb0ffece40da'.toLowerCase()], // deployed block 3_200_559
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
          address: ['0x5e7bb104d84c7cb9b682aac2f3d509f5f406809a'.toLowerCase()], // deployed block 13_843_704
          topic0: [AerodromeSlipstreamFactoryEvents.PoolCreated.topic],
          transaction: true,
        },
        swaps: {
          topic0: [AerodromeSlipstreamSwapEvents.Swap.topic],
          transaction: true,
        },
      },
    },
  },
};

export const MulticallAddresses: Record<Network, string> = {
  ethereum: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
  base: '0xcA11bde05977b3631167028862bE2a173976CA11',
};
