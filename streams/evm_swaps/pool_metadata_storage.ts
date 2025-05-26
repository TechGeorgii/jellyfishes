import { DatabaseSync, StatementSync } from 'node:sqlite';
import { uniq } from 'lodash';
import { Network } from './networks';
import { DexName, DexProtocol } from './swap_types';

export type PoolMetadata = {
  network: Network;
  dex_name: DexName;
  protocol: DexProtocol;
  pool: string;
  token_a: string;
  token_b: string;
  factory_address: string;
  tick_spacing?: number | null;
  fee?: number | null;
  stable?: number;
  block_number: number;
};

export type TokenMetadata = {
  network: Network;
  address: string;
  decimals: number;
  symbol: string;
};

export class PoolMetadataStorage {
  db: DatabaseSync;
  statements: Record<string, StatementSync>;
  poolMetadataMap: Map<string, PoolMetadata>;
  tokenMetadataMap: Map<string, TokenMetadata>;

  constructor(
    private readonly dbPath: string,
    public readonly network: Network,
  ) {
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS "evm_pools" (network TEXT, dex_name TEXT, protocol TEXT, pool TEXT, token_a TEXT, token_b TEXT, factory_address TEXT, block_number INTEGER, tick_spacing INTEGER, fee INTEGER, stable INTEGER, PRIMARY KEY (network, pool))',
    );
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS "evm_tokens" (network TEXT, address TEXT, decimals INTEGER, symbol TEXT, PRIMARY KEY (network, address))',
    );
    this.statements = {
      insert: this.db.prepare(
        'INSERT OR IGNORE INTO "evm_pools" VALUES (:network, :dex_name, :protocol, :pool, :token_a, :token_b, :factory_address, :block_number, :tick_spacing, :fee, :stable)',
      ),
      insertTokens: this.db.prepare(
        'INSERT OR IGNORE INTO "evm_tokens" VALUES (:network, :address, :decimals, :symbol)',
      ),
    };
    this.poolMetadataMap = new Map();
  }

  getTokenMetadata(tokenAddress: string): TokenMetadata | undefined {
    const key = `${this.network}-${tokenAddress}`;
    let tokenMetadata = this.tokenMetadataMap.get(key);

    if (!tokenMetadata) {
      const md = this.getTokenMetadataFromDb([tokenAddress]);
      tokenMetadata = md[key];

      if (tokenMetadata) {
        this.tokenMetadataMap.set(key, tokenMetadata);
      } else {
        return undefined;
      }
    }
    return tokenMetadata;
  }

  // FIXME rewrite for batch fetch
  getPoolMetadata(pool: string): PoolMetadata | undefined {
    const key = `${this.network}-${pool}`;
    let poolMetadata = this.poolMetadataMap.get(key);
    if (!poolMetadata) {
      const metadata = this.getPoolMetadataFromDb([{ address: pool }]);
      poolMetadata = metadata[key];

      if (poolMetadata) {
        this.poolMetadataMap.set(key, poolMetadata);
      } else {
        return undefined;
      }
    }

    return poolMetadata;
  }

  savePoolMetadataIntoDb(poolMetadata: PoolMetadata[]) {
    for (const pool of poolMetadata) {
      this.statements.insert.run(pool);
      this.poolMetadataMap.set(pool.pool, pool);
    }
  }

  saveTokenMetadataIntoDb(tokenMetadata: TokenMetadata[]) {
    for (const token of tokenMetadata) {
      this.statements.insertTokens.run(token);
    }
  }

  getPoolMetadataFromDb(logs: { address: string }[]): Record<string, PoolMetadata> {
    const pools = uniq(logs.map((l) => l.address));
    if (!pools.length) return {};

    const params = new Array(pools.length).fill('?').join(',');
    const select = this.db.prepare(`
        SELECT *
        FROM "evm_pools"
        WHERE "network" = ? AND "pool" IN (${params})
    `);

    const poolsMetadata = select.all(this.network, ...pools) as PoolMetadata[];

    return poolsMetadata.reduce(
      (res, pool) => ({
        ...res,
        [pool.pool]: pool,
      }),
      {},
    );
  }

  getTokenMetadataFromDb(tokenAddresses: string[]): Record<string, TokenMetadata> {
    if (!tokenAddresses.length) return {};

    const params = new Array(tokenAddresses.length).fill('?').join(',');
    const select = this.db.prepare(`
        SELECT *
        FROM "evm_token"
        WHERE "network" = ? AND "address" IN (${params})
    `);

    const tokensMetadata = select.all(this.network, ...tokenAddresses) as TokenMetadata[];

    return tokensMetadata.reduce(
      (res, token) => ({
        ...res,
        [`${this.network}-${token.address}`]: token,
      }),
      {},
    );
  }
}
