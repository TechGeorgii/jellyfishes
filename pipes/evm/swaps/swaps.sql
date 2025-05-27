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
