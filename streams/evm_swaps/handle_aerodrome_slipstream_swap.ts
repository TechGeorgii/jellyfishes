import { events as AerodromeSlipstreamSwapEvents } from './aerodrome.slipstream/swaps';
import { DecodedEvmSwap } from './swap_types';

export const handleAerodromeSlipstreamSwap = (log: any): DecodedEvmSwap | null => {
  const data = AerodromeSlipstreamSwapEvents.Swap.decode(log);

  return {
    dexName: 'aerodrome',
    protocol: 'aerodrome_slipstream',
    from: {
      amount: data.amount0,
      sender: data.sender,
    },
    to: {
      amount: data.amount1,
      recipient: data.recipient,
    },
    liquidity: data.liquidity,
    sqrtPriceX96: data.sqrtPriceX96,
    tick: data.tick,
  };
};
