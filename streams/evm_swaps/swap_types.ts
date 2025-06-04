import { BlockRef } from '../../core/portal_abstract_stream';

export const AllDexProtocols = [
  'uniswap_v3',
  'uniswap_v2',
  'aerodrome_basic',
  'aerodrome_slipstream',
] as const;

export type DexProtocol = (typeof AllDexProtocols)[number];
export type DexName = 'uniswap' | 'aerodrome';

export type EvmSwap = {
  dexName: DexName;
  protocol: DexProtocol;
  block: BlockRef;
  account: string;
  sender: string;
  recipient: string;
  tokenA: {
    amount_raw: bigint;
    amount_human: number;
    address: string;
    symbol?: string;
    decimals?: number;
  };
  tokenB: {
    amount_raw: bigint;
    amount_human: number;
    address: string;
    symbol?: string;
    decimals?: number;
  };
  factory: {
    address: string;
  };
  transaction: {
    hash: string;
    index: number;
    logIndex: number;
  };
  pool: {
    address: string;
    tick_spacing?: number | null;
    fee?: number | null;
    stable?: boolean;
    liquidity?: bigint;
    sqrtPriceX96?: bigint;
    tick?: number;
  };
  timestamp: Date;
};

export type ExtendedEvmSwap = EvmSwap & {
  price_token_a_usdc: number;
  price_token_b_usdc: number;
  a_b_swapped: boolean;
};

export type DecodedEvmSwap = {
  dexName: DexName;
  protocol: DexProtocol;
  from: {
    amount: bigint;
    sender: string;
  };
  to: {
    amount: bigint;
    recipient: string;
  };
  liquidity?: bigint;
  tick?: number;
  sqrtPriceX96?: bigint;
};
