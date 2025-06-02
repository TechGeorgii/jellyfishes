CREATE TABLE IF NOT EXISTS base_swaps_raw
(
    timestamp           DateTime CODEC (DoubleDelta, ZSTD),
    token_a             String,
    token_a_symbol      String,
    token_b             String,
    token_b_symbol      String,
    amount_a_raw        Int128,
    amount_b_raw        Int128,
    amount_a            Float64,
    amount_b            Float64,
    price_token_a_usdc  Float64,
    price_token_b_usdc  Float64,
    factory_address     LowCardinality(String),
    dex_name            LowCardinality(String),
    protocol            LowCardinality(String),
    pool_address        String,
    pool_tick_spacing   Int32,
    pool_fee_creation   UInt32,
    pool_stable         Bool,
    pool_liquidity      UInt128,
    pool_sqrt_price_x96 UInt256,
    pool_tick           Int32,
    account             String,
    sender              String,
    recipient           String,
    block_number        UInt32 CODEC (DoubleDelta, ZSTD),
    transaction_index   UInt16,
    log_index           UInt16,
    transaction_hash    String,
    token_a_decimals    UInt8,
    token_b_decimals    UInt8,
    sign                Int8
) ENGINE = CollapsingMergeTree(sign)
      PARTITION BY toYYYYMM(timestamp) -- DATA WILL BE SPLIT BY MONTH
      ORDER BY (timestamp, transaction_index, log_index);

-- ############################################################################################################
--
-- ############################################################################################################

CREATE MATERIALIZED VIEW IF NOT EXISTS base_swaps_raw_pool_gr_mv
ENGINE = CollapsingMergeTree(sign)
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (pool_address, timestamp, transaction_index, log_index)
POPULATE
AS
SELECT * FROM base_swaps_raw;

CREATE MATERIALIZED VIEW IF NOT EXISTS base_swaps_raw_with_pool_vol_mv
ENGINE = CollapsingMergeTree(sign)
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, transaction_index, log_index)
POPULATE
AS
SELECT 
    s.*,
    sum(ABS(amount_b * price_token_b_usdc) * sign) OVER (
        PARTITION BY pool_address
        ORDER BY timestamp
        RANGE BETWEEN 86400*7 PRECEDING AND CURRENT ROW
    ) as pool_week_volume_usdc
FROM base_swaps_raw_pool_gr_mv s;

-- Materialized view to count swaps per token
-- For example, can be used to filter out tokens with less than X swaps (garbage tokens).
CREATE TABLE IF NOT EXISTS base_token_swap_counts
(
    token String,
    swap_count UInt64
) ENGINE = SummingMergeTree()
    ORDER BY (token);


CREATE MATERIALIZED VIEW IF NOT EXISTS base_token_swap_counts_mv1 TO base_token_swap_counts
AS
SELECT 
    token_a AS token,
    sign AS swap_count
FROM base_swaps_raw;

CREATE MATERIALIZED VIEW IF NOT EXISTS base_token_swap_counts_mv2 TO base_token_swap_counts
AS
SELECT 
    token_b AS token,
    sign AS swap_count
FROM base_swaps_raw;


CREATE MATERIALIZED VIEW IF NOT EXISTS base_swaps_vols_mv
(
    timestamp           	DateTime CODEC (DoubleDelta, ZSTD),
    pool_address        	String,
    token               	String,
    price_token_usd     	Float64,
    amount              	Float64,
    volume_5min         	Float64,
    volume_1hr          	Float64,
    volume_6hr          	Float64,
    volume_24hr         	Float64,
    swap_count_5min         Float64,
    swap_count_1hr          Float64,
    swap_count_6hr          Float64,
    swap_count_24hr         Float64,
    sign                	Int8
) ENGINE = MergeTree()
    PARTITION BY toYYYYMM(timestamp)
    ORDER BY (timestamp, pool_address)
    TTL timestamp + INTERVAL 120 DAY
	POPULATE
AS
SELECT
    timestamp,
    pool_address,
    token_a AS token,
    price_token_a_usdc AS price_token_usd,
    amount_a AS amount,
    	sum(abs(IF(isNaN(amount_a * price_token_a_usdc), 0, amount_a * price_token_a_usdc))*sign) OVER (
        PARTITION BY pool_address
        ORDER BY timestamp
        RANGE BETWEEN 300 PRECEDING AND CURRENT ROW
    ) AS volume_5min,
        sum(abs(IF(isNaN(amount_a * price_token_a_usdc), 0, amount_a * price_token_a_usdc))*sign) OVER (
        PARTITION BY pool_address
        ORDER BY timestamp
        RANGE BETWEEN 3600 PRECEDING AND CURRENT ROW
    ) AS volume_1hr,
        sum(abs(IF(isNaN(amount_a * price_token_a_usdc), 0, amount_a * price_token_a_usdc))*sign) OVER (
        PARTITION BY pool_address
        ORDER BY timestamp
        RANGE BETWEEN 21600 PRECEDING AND CURRENT ROW
    ) AS volume_6hr,
        sum(abs(IF(isNaN(amount_a * price_token_a_usdc), 0, amount_a * price_token_a_usdc))*sign) OVER (
        PARTITION BY pool_address
        ORDER BY timestamp
        RANGE BETWEEN 86400 PRECEDING AND CURRENT ROW
    ) AS volume_24hr,
	sum(sign) OVER (
        PARTITION BY pool_address
        ORDER BY timestamp
        RANGE BETWEEN 300 PRECEDING AND CURRENT ROW
    ) AS swap_count_5min,
        sum(sign) OVER (
        PARTITION BY pool_address
        ORDER BY timestamp
        RANGE BETWEEN 3600 PRECEDING AND CURRENT ROW
    ) AS swap_count_1hr,
        sum(sign) OVER (
        PARTITION BY pool_address
        ORDER BY timestamp
        RANGE BETWEEN 21600 PRECEDING AND CURRENT ROW
    ) AS swap_count_6hr,
        sum(sign) OVER (
        PARTITION BY pool_address
        ORDER BY timestamp
        RANGE BETWEEN 86400 PRECEDING AND CURRENT ROW
    ) AS swap_count_24hr,
    sign
FROM base_swaps_raw_pool_gr_mv
WHERE price_token_usd > 0;

-- Materialized view that generates Base 5-minute candlestick data for pools/tokens
CREATE MATERIALIZED VIEW IF NOT EXISTS base_token_candlesticks_5min_mv
(
    timestamp DateTime CODEC (DoubleDelta, ZSTD),
    token                   String,
	pool_address			String,    
    open_price_token_usd    Float64,
    high_price_token_usd    Float64,
    low_price_token_usd	    Float64,
    close_price_token_usd   Float64,
    volume_5min_usd	        Float64,
    volume_1hr_usd	        Float64,
    volume_6hr_usd	        Float64,
    volume_24hr_usd	        Float64,
    swap_count_5min         Float64,
    swap_count_1hr          Float64,
    swap_count_6hr          Float64,
    swap_count_24hr         Float64
) ENGINE = ReplacingMergeTree()
    PARTITION BY toYYYYMM(timestamp)
    ORDER BY (timestamp, pool_address)
    TTL timestamp + INTERVAL 120 DAY
    POPULATE
AS
SELECT
    toStartOfFiveMinutes(timestamp) AS timestamp
    , pp.token
    , pp.pool_address
    , argMin(price_token_usd, pp.timestamp) AS open_price_token_usd
    , max(price_token_usd) AS high_price_token_usd
    , min(price_token_usd) AS low_price_token_usd
    , argMax(price_token_usd, pp.timestamp) AS close_price_token_usd
	, argMax(pp.volume_5min, pp.timestamp) AS volume_5min_usd
	, argMax(pp.volume_1hr, pp.timestamp) AS volume_1hr_usd
	, argMax(pp.volume_6hr, pp.timestamp) AS volume_6hr_usd
	, argMax(pp.volume_24hr, pp.timestamp) AS volume_24hr_usd
	, argMax(pp.swap_count_5min, pp.timestamp) AS swap_count_5min
	, argMax(pp.swap_count_1hr, pp.timestamp) AS swap_count_1hr
	, argMax(pp.swap_count_6hr, pp.timestamp) AS swap_count_6hr
	, argMax(pp.swap_count_24hr, pp.timestamp) AS swap_count_24hr
FROM base_swaps_vols_mv pp
WHERE price_token_usd > 0
GROUP BY timestamp, pool_address, token
ORDER BY timestamp, pool_address, token;
