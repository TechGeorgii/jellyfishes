import { Logger } from 'pino';
import { EvmSwap } from './swap_types';
import { MulticallAddresses, Network } from './networks';
import { ethers, JsonRpcProvider } from 'ethers';
import dotenv from 'dotenv';
import * as assert from 'assert';

dotenv.config();

const TOKEN_BATCH_LEN = 100;

export class TokenOnchainHelper {
  provider: JsonRpcProvider;

  constructor(
    private readonly logger: Logger,
    private readonly network: Network,
  ) {
    const key = `${network.toUpperCase()}_RPC_URL`;
    const rpcUrl = process.env[key];
    assert.ok(rpcUrl, `${key} is not specified`);
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  async enrichWithTokenData(events: EvmSwap[]) {
    const tokenAddresses = new Set<string>();
    events.forEach((event) => {
      if (event.tokenA.decimals === undefined) {
        tokenAddresses.add(event.tokenA.address);
      }
      if (event.tokenB.decimals === undefined) {
        tokenAddresses.add(event.tokenB.address);
      }
    });

    const tokenMetadata = new Map<string, { decimals: number; symbol: string }>();
    let uniqueTokens = Array.from(tokenAddresses);

    try {
      while (uniqueTokens.length) {
        // break them to batches TOKEN_BATCH_LEN each
        const endIndex = Math.min(uniqueTokens.length, TOKEN_BATCH_LEN);
        const currentTokenBatch = uniqueTokens.slice(0, endIndex);
        uniqueTokens = uniqueTokens.slice(endIndex, uniqueTokens.length);

        const calls = currentTokenBatch.flatMap((tokenAddress) => [
          {
            target: tokenAddress,
            // decimals() function selector: 0x313ce567
            callData: '0x313ce567',
          },
          {
            target: tokenAddress,
            // symbol() function selector: 0x95d89b41
            callData: '0x95d89b41',
          },
        ]);

        const results = await this.executeMulticall(calls);

        for (let i = 0; i < currentTokenBatch.length; i++) {
          const tokenAddress = currentTokenBatch[i];
          const decimalsIndex = i * 2;
          const symbolIndex = i * 2 + 1;

          try {
            // Parse decimals (uint8)
            const decimalsResult = results[decimalsIndex];
            const decimals = decimalsResult ? parseInt(decimalsResult.slice(-2), 16) : 18;

            // Parse symbol (string)
            const symbolResult = results[symbolIndex];
            const symbol = symbolResult ? this.parseStringFromHex(symbolResult) : '';

            tokenMetadata.set(tokenAddress, {
              decimals,
              symbol,
            });
          } catch (decodeError) {
            tokenMetadata.set(tokenAddress, {
              decimals: 18,
              symbol: '',
            });
          }
        }
      }

      // Enrich events with token metadata
      events.forEach((event) => {
        if (event.tokenA.decimals === undefined) {
          const tokenAData = tokenMetadata.get(event.tokenA.address);
          assert.ok(tokenAData);
          event.tokenA.decimals = tokenAData.decimals;
          event.tokenA.symbol = tokenAData.symbol;
        }

        if (event.tokenB.decimals === undefined) {
          const tokenBData = tokenMetadata.get(event.tokenB.address);
          assert.ok(tokenBData);
          event.tokenB.decimals = tokenBData.decimals;
          event.tokenB.symbol = tokenBData.symbol;
        }
      });
    } catch (error) {
      this.logger.error('Failed to enrich token data with multicall:', error);
    }
  }

  private async executeMulticall(
    calls: Array<{ target: string; callData: string }>,
  ): Promise<string[]> {
    const multicallAddress = MulticallAddresses[this.network];
    if (!multicallAddress) {
      throw new Error(`Multicall contract not configured for network: ${this.network}`);
    }

    const multicallAbi = [
      'function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)',
    ];

    const multicallContract = new ethers.Contract(multicallAddress, multicallAbi, this.provider);
    const [, returnData] = await multicallContract.aggregate(calls);
    return returnData.map((data: any) => ethers.hexlify(data));
  }

  private parseStringFromHex(hex: string): string {
    try {
      // Remove 0x prefix and parse string from hex
      const cleanHex = hex.replace('0x', '');
      // Skip the first 64 characters (length encoding) and convert to string
      const stringData = cleanHex.slice(128);
      let result = '';
      for (let i = 0; i < stringData.length; i += 2) {
        const charCode = parseInt(stringData.substr(i, 2), 16);
        if (charCode === 0) break;
        result += String.fromCharCode(charCode);
      }
      return result || '';
    } catch {
      return '';
    }
  }
}
