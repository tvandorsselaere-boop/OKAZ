-- =============================================
-- OKAZ - Migration v0.8.1
-- Ajout systeme Pro/Premium avec quotas mensuels
-- A executer dans Supabase SQL Editor
-- =============================================

-- 1. Nouvelles colonnes sur okaz_users
ALTER TABLE okaz_users
  ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS monthly_searches_limit INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_searches_used INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_reset_date DATE;

-- 2. Migrer les anciens premium vers le plan "premium"
UPDATE okaz_users
SET
  plan_type = 'premium',
  plan_until = premium_until,
  monthly_searches_limit = 500,
  monthly_searches_used = 0,
  monthly_reset_date = DATE_TRUNC('month', CURRENT_DATE)::DATE
WHERE premium_until IS NOT NULL AND premium_until > NOW();

-- 3. Mettre a jour la contrainte CHECK sur okaz_purchases.type
-- (ajouter 'pro' et 'premium' comme types valides)
ALTER TABLE okaz_purchases DROP CONSTRAINT IF EXISTS okaz_purchases_type_check;
ALTER TABLE okaz_purchases ADD CONSTRAINT okaz_purchases_type_check
  CHECK (type IN ('boost', 'plus', 'pro', 'premium'));

-- 4. Mettre a jour la fonction consume_search pour les plans
CREATE OR REPLACE FUNCTION consume_search(p_extension_uuid VARCHAR(36), p_daily_limit INT DEFAULT 5)
RETURNS TABLE(allowed BOOLEAN, source VARCHAR, remaining INT, boost_remaining INT) AS $$
DECLARE
  quota_record okaz_quotas;
  user_record okaz_users;
BEGIN
  -- Verifier si plan actif (pro ou premium)
  SELECT * INTO user_record
  FROM okaz_users
  WHERE extension_uuid = p_extension_uuid
    AND plan_type IN ('pro', 'premium')
    AND plan_until > NOW();

  IF FOUND THEN
    -- Reset mensuel si necessaire
    IF user_record.monthly_reset_date IS NULL
       OR user_record.monthly_reset_date < DATE_TRUNC('month', CURRENT_DATE)::DATE THEN
      UPDATE okaz_users
      SET monthly_searches_used = 0,
          monthly_reset_date = DATE_TRUNC('month', CURRENT_DATE)::DATE
      WHERE id = user_record.id;
      user_record.monthly_searches_used := 0;
    END IF;

    -- Verifier quota mensuel
    IF user_record.monthly_searches_used < user_record.monthly_searches_limit THEN
      UPDATE okaz_users
      SET monthly_searches_used = monthly_searches_used + 1
      WHERE id = user_record.id;

      RETURN QUERY SELECT
        true,
        'plan'::VARCHAR,
        user_record.monthly_searches_limit - user_record.monthly_searches_used - 1,
        0;
      RETURN;
    ELSE
      -- Quota mensuel epuise
      RETURN QUERY SELECT false, 'exhausted'::VARCHAR, 0, 0;
      RETURN;
    END IF;
  END IF;

  -- Utilisateur gratuit : quota journalier
  SELECT * INTO quota_record FROM get_or_create_daily_quota(p_extension_uuid);

  IF quota_record.searches_used < p_daily_limit THEN
    UPDATE okaz_quotas
    SET searches_used = searches_used + 1
    WHERE id = quota_record.id;

    RETURN QUERY SELECT
      true,
      'daily'::VARCHAR,
      p_daily_limit - quota_record.searches_used - 1,
      quota_record.boost_credits;
    RETURN;
  END IF;

  -- Quota journalier epuise, verifier boost
  IF quota_record.boost_credits > 0 THEN
    UPDATE okaz_quotas
    SET boost_credits = boost_credits - 1
    WHERE id = quota_record.id;

    RETURN QUERY SELECT
      true,
      'boost'::VARCHAR,
      0,
      quota_record.boost_credits - 1;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, 'exhausted'::VARCHAR, 0, 0;
END;
$$ LANGUAGE plpgsql;

-- 5. Verification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'okaz_users'
ORDER BY ordinal_position;
