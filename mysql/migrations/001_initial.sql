-- Importe no banco criado pelo cPanel. Compatível com MySQL 8.0+ / MariaDB 10.6+.
-- Não cria usuários nem altera permissões da hospedagem.
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  org VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  password VARCHAR(200) CHARACTER SET ascii NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  `user` VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires BIGINT NOT NULL,
  INDEX sessions_expires (expires),
  CONSTRAINT sessions_user_fk FOREIGN KEY (`user`) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  org VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(160) NOT NULL,
  segment VARCHAR(200),
  audience TEXT,
  description MEDIUMTEXT,
  INDEX clients_org (org)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  org VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  client VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(160) NOT NULL,
  objective MEDIUMTEXT,
  duration INTEGER NOT NULL,
  status VARCHAR(40) NOT NULL,
  scenes MEDIUMTEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX projects_org (org),
  CONSTRAINT projects_client_fk FOREIGN KEY (client) REFERENCES clients(id),
  CONSTRAINT projects_duration_check CHECK (duration BETWEEN 5 AND 3600),
  CONSTRAINT projects_version_check CHECK (version > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS versions (
  project VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  version INTEGER NOT NULL,
  scenes MEDIUMTEXT NOT NULL,
  created VARCHAR(40) NOT NULL,
  PRIMARY KEY (project, version),
  CONSTRAINT versions_project_fk FOREIGN KEY (project) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS rate_limits (
  `key` VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  `count` INTEGER NOT NULL,
  expires BIGINT NOT NULL,
  INDEX rate_limits_expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
