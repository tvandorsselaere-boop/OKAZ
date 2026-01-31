-- =============================================
-- OKAZ - Schéma Base de Données
-- Système d'identification et paiement
-- =============================================

-- Table utilisateurs (premium uniquement, identifiés par email)
CREATE TABLE IF NOT EXISTS okaz_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  extension_uuid VARCHAR(36),              -- Lien avec extension anonyme
  premium_until TIMESTAMPTZ,               -- Date fin premium (NULL = pas premium)
  current_token_jti VARCHAR(36),           -- JTI du token actif (pour révocation)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table achats (boost + premium)
CREATE TABLE IF NOT EXISTS okaz_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES okaz_users(id),  -- NULL pour achats boost anonymes
  extension_uuid VARCHAR(36),              -- UUID extension (pour boost)
  stripe_payment_id VARCHAR(255) NOT NULL,
  stripe_customer_id VARCHAR(255),
  type VARCHAR(20) NOT NULL CHECK (type IN ('boost', 'premium')),
  amount_cents INT NOT NULL,
  credits_added INT,                       -- Pour boost uniquement
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table quotas journaliers (par UUID extension)
CREATE TABLE IF NOT EXISTS okaz_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_uuid VARCHAR(36) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  searches_used INT DEFAULT 0,
  boost_credits INT DEFAULT 0,             -- Crédits boost achetés
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(extension_uuid, date)
);

-- Table tokens Magic Link (temporaires)
CREATE TABLE IF NOT EXISTS okaz_magic_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,                     -- NULL = pas encore utilisé
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table tokens révoqués (blacklist JWT)
CREATE TABLE IF NOT EXISTS okaz_revoked_tokens (
  jti VARCHAR(36) PRIMARY KEY,
  revoked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL          -- Pour cleanup automatique
);

-- =============================================
-- INDEX
-- =============================================

CREATE INDEX IF NOT EXISTS idx_okaz_users_email ON okaz_users(email);
CREATE INDEX IF NOT EXISTS idx_okaz_users_extension_uuid ON okaz_users(extension_uuid);
CREATE INDEX IF NOT EXISTS idx_okaz_purchases_extension_uuid ON okaz_purchases(extension_uuid);
CREATE INDEX IF NOT EXISTS idx_okaz_quotas_extension_uuid_date ON okaz_quotas(extension_uuid, date);
CREATE INDEX IF NOT EXISTS idx_okaz_magic_tokens_token ON okaz_magic_tokens(token);
CREATE INDEX IF NOT EXISTS idx_okaz_magic_tokens_email ON okaz_magic_tokens(email);
CREATE INDEX IF NOT EXISTS idx_okaz_revoked_tokens_expires ON okaz_revoked_tokens(expires_at);

-- =============================================
-- TRIGGERS
-- =============================================

-- Fonction pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers updated_at
DROP TRIGGER IF EXISTS okaz_users_updated_at ON okaz_users;
CREATE TRIGGER okaz_users_updated_at
  BEFORE UPDATE ON okaz_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS okaz_quotas_updated_at ON okaz_quotas;
CREATE TRIGGER okaz_quotas_updated_at
  BEFORE UPDATE ON okaz_quotas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- RLS (Row Level Security)
-- =============================================

-- Activer RLS
ALTER TABLE okaz_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE okaz_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE okaz_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE okaz_magic_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE okaz_revoked_tokens ENABLE ROW LEVEL SECURITY;

-- Policies: accès uniquement via service_role (API server-side)
-- Les utilisateurs n'accèdent jamais directement à ces tables

CREATE POLICY "Service role full access okaz_users" ON okaz_users
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access okaz_purchases" ON okaz_purchases
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access okaz_quotas" ON okaz_quotas
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access okaz_magic_tokens" ON okaz_magic_tokens
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access okaz_revoked_tokens" ON okaz_revoked_tokens
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- FONCTIONS UTILITAIRES
-- =============================================

-- Fonction pour nettoyer les tokens expirés (à appeler via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  -- Supprimer magic tokens expirés
  DELETE FROM okaz_magic_tokens WHERE expires_at < NOW();

  -- Supprimer tokens révoqués expirés
  DELETE FROM okaz_revoked_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir ou créer un quota journalier
CREATE OR REPLACE FUNCTION get_or_create_daily_quota(p_extension_uuid VARCHAR(36))
RETURNS okaz_quotas AS $$
DECLARE
  quota_record okaz_quotas;
BEGIN
  -- Essayer de récupérer le quota existant
  SELECT * INTO quota_record
  FROM okaz_quotas
  WHERE extension_uuid = p_extension_uuid AND date = CURRENT_DATE;

  -- Si pas trouvé, créer
  IF NOT FOUND THEN
    INSERT INTO okaz_quotas (extension_uuid, date, searches_used, boost_credits)
    VALUES (p_extension_uuid, CURRENT_DATE, 0, 0)
    RETURNING * INTO quota_record;
  END IF;

  RETURN quota_record;
END;
$$ LANGUAGE plpgsql;

-- Fonction atomique pour consommer une recherche
CREATE OR REPLACE FUNCTION consume_search(p_extension_uuid VARCHAR(36), p_daily_limit INT DEFAULT 5)
RETURNS TABLE(allowed BOOLEAN, source VARCHAR, remaining INT, boost_remaining INT) AS $$
DECLARE
  quota_record okaz_quotas;
  user_record okaz_users;
BEGIN
  -- Vérifier si premium
  SELECT * INTO user_record
  FROM okaz_users
  WHERE extension_uuid = p_extension_uuid AND premium_until > NOW();

  IF FOUND THEN
    -- Premium = toujours autorisé
    RETURN QUERY SELECT true, 'premium'::VARCHAR, -1, -1;
    RETURN;
  END IF;

  -- Récupérer ou créer quota
  SELECT * INTO quota_record FROM get_or_create_daily_quota(p_extension_uuid);

  -- Vérifier quota journalier
  IF quota_record.searches_used < p_daily_limit THEN
    -- Incrémenter et autoriser
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

  -- Quota journalier épuisé, vérifier crédits boost
  IF quota_record.boost_credits > 0 THEN
    -- Consommer un crédit boost
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

  -- Aucun quota disponible
  RETURN QUERY SELECT
    false,
    'exhausted'::VARCHAR,
    0,
    0;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour ajouter des crédits boost
CREATE OR REPLACE FUNCTION add_boost_credits(p_extension_uuid VARCHAR(36), p_credits INT DEFAULT 10)
RETURNS INT AS $$
DECLARE
  quota_record okaz_quotas;
  new_total INT;
BEGIN
  -- Récupérer ou créer quota
  SELECT * INTO quota_record FROM get_or_create_daily_quota(p_extension_uuid);

  -- Ajouter les crédits
  UPDATE okaz_quotas
  SET boost_credits = boost_credits + p_credits
  WHERE id = quota_record.id
  RETURNING boost_credits INTO new_total;

  RETURN new_total;
END;
$$ LANGUAGE plpgsql;
