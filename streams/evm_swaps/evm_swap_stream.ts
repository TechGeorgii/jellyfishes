import { BlockRef, PortalAbstractStream } from '../../core/portal_abstract_stream';

import { Network, NetworksMappings } from './networks';
import { PoolMetadata, PoolMetadataStorage } from './pool_metadata_storage';
import { AllDexProtocols, DexProtocol, DecodedEvmSwap, EvmSwap } from './swap_types';

import { events as UniswapV2FactoryEvents } from './uniswap.v2/factory';
import { events as UniswapV2SwapsEvents } from './uniswap.v2/swaps';
import { events as UniswapV3FactoryEvents } from './uniswap.v3/factory';
import { events as UniswapV3SwapsEvents } from './uniswap.v3/swaps';
import { events as AerodromeBasicFactoryEvents } from './aerodrome.basic/factory';
import { events as AerodromeBasicSwapEvents } from './aerodrome.basic/swaps';
import { events as AerodromeSlipstreamFactoryEvents } from './aerodrome.slipstream/factory';
import { events as AerodromeSlipstreamSwapEvents } from './aerodrome.slipstream/swaps';

import { nonNullable } from './util';
import { handleAerodromeBasicSwap } from './handle_aerodrome_basic_swap';
import { handleAerodromeSlipstreamSwap } from './handle_aerodrome_slipstream_swap';
import { handleUniswapV2Swap } from './handle_uniswap_v2_swap';
import { handleUniswapV3Swap } from './handle_uniswap_v3_swap';
import { symbols } from 'pino';
import { TokenMetadataStorage } from './token_metadata_storage';

type Args = {
  network: Network;
  dbPath: string;
  protocols?: DexProtocol[];
  onlyPools?: boolean;
};

export class EvmSwapStream extends PortalAbstractStream<EvmSwap, Args> {
  poolMetadataStorage: PoolMetadataStorage;
  tokenOnchainHelper: TokenMetadataStorage;

  initialize() {
    this.poolMetadataStorage = new PoolMetadataStorage(
      this.options.args.dbPath,
      this.options.args.network,
    );
    this.tokenOnchainHelper = new TokenMetadataStorage(
      this.options.args.dbPath,
      this.logger,
      this.options.args.network,
    );
  }

  async stream(): Promise<ReadableStream<EvmSwap[]>> {
    const { args } = this.options;

    const protocols = args?.protocols || AllDexProtocols;

    const source = await this.getStream({
      type: 'evm',
      fields: {
        block: {
          number: true,
          hash: true,
          timestamp: true,
        },
        transaction: {
          from: true,
          to: true,
          hash: true,
        },
        log: {
          address: true,
          topics: true,
          data: true,
          transactionHash: true,
          logIndex: true,
          transactionIndex: true,
        },
      },
      logs: protocols.flatMap((protocol) => {
        const mapping = NetworksMappings[args.network][protocol];
        if (!mapping) {
          throw new Error(`Protocol "${protocol}" is not supported in ${args.network} chain`);
        }

        if (args.onlyPools) {
          return [mapping.pools];
        }

        return [mapping.pools, mapping.swaps];
      }),
    });

    return source.pipeThrough(
      new TransformStream({
        transform: async ({ blocks }, controller) => {
          this.handlePools(blocks);

          if (args.onlyPools) {
            // FIXME bad design
            controller.enqueue([]);
            return;
          }

          const events = blocks
            .flatMap((block: any) => {
              if (!block.logs || !block.transactions) return [];

              return block.logs.map((log) => {
                const transaction = block.transactions.find(
                  (tx) => tx.hash === log.transactionHash,
                );
                if (!transaction) {
                  this.logger.error(
                    `transaction not found ${log.transactionHash} in block ${block.header.number}`,
                  );
                  return null;
                }

                const poolMetadata = this.poolMetadataStorage.getPoolMetadata(log.address);
                if (!poolMetadata) {
                  return null;
                }

                let swap: DecodedEvmSwap | null = null;
                if (UniswapV2SwapsEvents.Swap.is(log) && poolMetadata.protocol === 'uniswap_v2') {
                  swap = handleUniswapV2Swap(log);
                } else if (
                  UniswapV3SwapsEvents.Swap.is(log) &&
                  poolMetadata.protocol === 'uniswap_v3'
                ) {
                  swap = handleUniswapV3Swap(log);
                } else if (
                  AerodromeBasicSwapEvents.Swap.is(log) &&
                  poolMetadata.protocol === 'aerodrome_basic'
                ) {
                  swap = handleAerodromeBasicSwap(log);
                } else if (
                  AerodromeSlipstreamSwapEvents.Swap.is(log) &&
                  poolMetadata.protocol === 'aerodrome_slipstream'
                ) {
                  swap = handleAerodromeSlipstreamSwap(log);
                }

                if (!swap) {
                  return null;
                }

                const tokenA_Metadata = this.tokenOnchainHelper.getTokenMetadata(
                  poolMetadata.token_a,
                );
                const tokenB_Metadata = this.tokenOnchainHelper.getTokenMetadata(
                  poolMetadata.token_b,
                );

                return {
                  dexName: swap.dexName,
                  protocol: swap.protocol,
                  account: transaction.from,
                  sender: swap.from.sender,
                  recipient: swap.to.recipient,
                  tokenA: {
                    amount: swap.from.amount,
                    address: poolMetadata.token_a,
                    decimals: tokenA_Metadata?.decimals,
                    symbol: tokenA_Metadata?.symbol,
                  },
                  tokenB: {
                    amount: swap.to.amount,
                    address: poolMetadata.token_b,
                    decimals: tokenB_Metadata?.decimals,
                    symbol: tokenB_Metadata?.symbol,
                  },
                  pool: {
                    address: log.address,
                    tick_spacing: poolMetadata.tick_spacing,
                    fee: poolMetadata.fee,
                    stable:
                      poolMetadata.stable === undefined ? undefined : poolMetadata.stable === 1,
                    liquidity: swap.liquidity,
                    sqrtPriceX96: swap.sqrtPriceX96,
                    tick: swap.tick,
                  },
                  factory: {
                    address: poolMetadata.factory_address,
                  },
                  block: block.header,
                  transaction: {
                    hash: log.transactionHash,
                    index: log.transactionIndex,
                    logIndex: log.logIndex,
                  },
                  timestamp: new Date(block.header.timestamp * 1000),
                } satisfies EvmSwap;
              });
            })
            .filter(Boolean);

          if (!events.length) return;

          await this.tokenOnchainHelper.enrichWithTokenData(events);

          controller.enqueue(events);
        },
      }),
    );
  }

  private handlePools(blocks: any[]) {
    const { args } = this.options;

    const pools = blocks
      .flatMap((block: any) => {
        if (!block.logs) return [];

        return block.logs.map((l) => {
          let md: PoolMetadata | null = null;
          if (UniswapV2FactoryEvents.PairCreated.is(l)) {
            const data = UniswapV2FactoryEvents.PairCreated.decode(l);
            md = {
              network: args.network,
              pool: data.pair,
              token_a: data.token0,
              token_b: data.token1,
              factory_address: l.address,
              dex_name: 'uniswap',
              protocol: 'uniswap_v2',
              block_number: block.header.number,
            };
          } else if (UniswapV3FactoryEvents.PoolCreated.is(l)) {
            const data = UniswapV3FactoryEvents.PoolCreated.decode(l);
            md = {
              network: args.network,
              pool: data.pool,
              token_a: data.token0,
              token_b: data.token1,
              factory_address: l.address,
              dex_name: 'uniswap',
              protocol: 'uniswap_v3',
              fee: data.fee,
              tick_spacing: data.tickSpacing,
              block_number: block.header.number,
            };
          } else if (AerodromeBasicFactoryEvents.PoolCreated.is(l)) {
            const data = AerodromeBasicFactoryEvents.PoolCreated.decode(l);
            md = {
              network: args.network,
              pool: data.pool,
              token_a: data.token0,
              token_b: data.token1,
              factory_address: l.address,
              dex_name: 'aerodrome',
              protocol: 'aerodrome_basic',
              stable: data.stable ? 1 : 0,
              block_number: block.header.number,
            };
          } else if (AerodromeSlipstreamFactoryEvents.PoolCreated.is(l)) {
            const data = AerodromeSlipstreamFactoryEvents.PoolCreated.decode(l);
            md = {
              network: args.network,
              pool: data.pool,
              token_a: data.token0,
              token_b: data.token1,
              factory_address: l.address,
              dex_name: 'aerodrome',
              protocol: 'aerodrome_slipstream',
              tick_spacing: data.tickSpacing,
              block_number: block.header.number,
            };
          }
          return md;
        });
      })
      .filter(nonNullable);
    if (pools.length) {
      this.poolMetadataStorage.savePoolMetadataIntoDb(pools);
    }
  }
}
