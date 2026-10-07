-- Stop purchase writes before running this PostgreSQL cutover migration.
BEGIN;

CREATE TABLE IF NOT EXISTS asset_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    source VARCHAR(100) NOT NULL,
    request_id VARCHAR(255),
    changes JSON NOT NULL,
    balances JSON NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_asset_transactions_user_id ON asset_transactions(user_id);
CREATE INDEX IF NOT EXISTS ix_asset_transactions_request_id ON asset_transactions(request_id);

CREATE TABLE IF NOT EXISTS commerce_operations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    request_id VARCHAR(36) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    payload JSON NOT NULL,
    result JSON NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_commerce_operation_request UNIQUE(user_id, request_id)
);
CREATE INDEX IF NOT EXISTS ix_commerce_operations_user_id ON commerce_operations(user_id);

CREATE TABLE IF NOT EXISTS game_purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    request_id VARCHAR(36) NOT NULL,
    game_key VARCHAR(100) NOT NULL,
    product_id VARCHAR(100) NOT NULL,
    purpose VARCHAR(100) NOT NULL,
    target VARCHAR(256) NOT NULL,
    cost JSON NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_game_purchase_request UNIQUE(user_id, request_id)
);
CREATE INDEX IF NOT EXISTS ix_game_purchases_user_id ON game_purchases(user_id);

-- Import historical purchases once; no runtime compatibility table is needed.
DO $$
BEGIN
    IF to_regclass('quantumgo_review_purchases') IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM quantumgo_review_purchases old
            JOIN game_purchases current
              ON current.user_id = old.user_id AND current.request_id = old.request_id
            WHERE current.game_key <> 'quantumgo' OR current.product_id <> 'ai-review'
               OR current.purpose <> 'ai-review' OR current.target <> old.target
               OR current.expires_at <> old.expires_at
               OR current.cost::jsonb <> jsonb_build_object('diamonds', old.cost)
        ) THEN
            RAISE EXCEPTION 'Conflicting purchase UUIDs; resolve before commerce cutover';
        END IF;
        INSERT INTO game_purchases
            (user_id, request_id, game_key, product_id, purpose, target, cost, expires_at, created_at)
        SELECT user_id, request_id, 'quantumgo', 'ai-review', 'ai-review', target,
               json_build_object('diamonds', cost), expires_at, created_at
        FROM quantumgo_review_purchases
        ON CONFLICT (user_id, request_id) DO NOTHING;
    END IF;
END $$;

COMMIT;
