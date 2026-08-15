import mysql from 'mysql2/promise';
import type { CardMetadataRecord, ControlledLibraryItem, SaveCardPayload } from './src/curationTypes';

const DEFAULT_ATTRIBUTE_SEED = ['face', 'blue'];
const DEFAULT_SERIES_SEED = ['01', '02'];
const ATTRIBUTE_SEPARATOR = '||__APHELION_ATTR__||';
const SERIES_SEPARATOR = ' | ';

type CardRow = {
  id: number;
  card_uid: string | null;
  image_path: string;
  image_code: string;
  folder_path: string;
  title: string | null;
  description: string | null;
  rarity: string | null;
  series_name: string | null;
  edition_size: number | null;
  review_status: 'untagged' | 'reviewed';
  updated_at: string | Date | null;
  attributes: string | null;
};

type DbConfig = {
  host: string;
  user: string;
  password: string;
  port: number;
  database: string;
};

function normalizeText(value: string | null | undefined) {
  return String(value || '').trim();
}

function normalizeNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }

  const parsed = Math.max(0, Math.floor(Number(value)));
  return parsed === 0 ? null : parsed;
}

function splitAttributes(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(ATTRIBUTE_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitSeriesNames(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinSeriesNames(values: string[]) {
  return Array.from(new Set(values.map((item) => normalizeText(item)).filter(Boolean))).join(SERIES_SEPARATOR);
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function toMysqlDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}

function getDbConfig(): DbConfig | null {
  const host = (process.env.MYSQL_HOST || '').trim();
  const user = (process.env.MYSQL_USER || '').trim();
  const database = (process.env.APHELION_MYSQL_DATABASE || process.env.MYSQL_DATABASE || '').trim();

  if (!host || !user || !database) {
    return null;
  }

  return {
    host,
    user,
    password: String(process.env.MYSQL_PASSWORD || ''),
    port: Number(process.env.MYSQL_PORT || '3306'),
    database,
  };
}

export function createCurationDb() {
  const config = getDbConfig();
  let pool: mysql.Pool | null = null;
  let schemaReady: Promise<void> | null = null;

  const listCardsSql = `
    SELECT
      c.id,
      c.card_uid,
      c.image_path,
      c.image_code,
      c.folder_path,
      c.title,
      c.description,
      c.rarity,
      c.series_name,
      c.edition_size,
      c.review_status,
      c.updated_at,
      GROUP_CONCAT(a.label ORDER BY a.label SEPARATOR '${ATTRIBUTE_SEPARATOR}') AS attributes
    FROM card_master c
    LEFT JOIN card_attribute_assignments ca
      ON ca.card_id = c.id
    LEFT JOIN card_attribute_library a
      ON a.id = ca.attribute_id
    GROUP BY
      c.id,
      c.card_uid,
      c.image_path,
      c.image_code,
      c.folder_path,
      c.title,
      c.description,
      c.rarity,
      c.series_name,
      c.edition_size,
      c.review_status,
      c.updated_at
  `;

  function assertConfigured() {
    if (!config) {
      throw new Error('Aphelion MySQL is not configured. Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_PORT, and MYSQL_DATABASE (or APHELION_MYSQL_DATABASE).');
    }
  }

  function mapCardRow(row: CardRow): CardMetadataRecord {
    return {
      id: row.id,
      cardUid: row.card_uid || null,
      imagePath: row.image_path,
      imageCode: row.image_code,
      folderPath: row.folder_path,
      title: row.title || '',
      description: row.description || '',
      rarity: (row.rarity as CardMetadataRecord['rarity']) || null,
      seriesName: row.series_name || '',
      editionSize: row.edition_size ?? null,
      reviewStatus: row.review_status,
      attributes: splitAttributes(row.attributes),
      updatedAt: toMysqlDateTime(row.updated_at) || null,
    };
  }

  async function getPool() {
    assertConfigured();
    if (pool) {
      return pool;
    }

    pool = mysql.createPool({
      host: config!.host,
      user: config!.user,
      password: config!.password,
      port: config!.port,
      database: config!.database,
      connectTimeout: 8000,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });
    return pool;
  }

  async function ensureSchema() {
    assertConfigured();
    if (schemaReady) {
      return schemaReady;
    }

    schemaReady = (async () => {
      const db = await getPool();

      await db.query(`
        CREATE TABLE IF NOT EXISTS card_master (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          card_uid VARCHAR(24) NULL UNIQUE,
          image_path TEXT NOT NULL,
          image_code VARCHAR(255) NOT NULL,
          folder_path TEXT NOT NULL,
          title VARCHAR(255) NULL,
          description TEXT NULL,
          rarity VARCHAR(32) NULL,
          series_name VARCHAR(255) NULL,
          edition_size INT NULL,
          review_status VARCHAR(32) NOT NULL DEFAULT 'untagged',
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL,
          UNIQUE KEY uq_card_master_image_path (image_path(255))
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS card_attribute_library (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          slug VARCHAR(80) NOT NULL UNIQUE,
          label VARCHAR(255) NOT NULL UNIQUE,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS card_series_library (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          slug VARCHAR(80) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL UNIQUE,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS card_attribute_assignments (
          card_id BIGINT NOT NULL,
          attribute_id BIGINT NOT NULL,
          PRIMARY KEY (card_id, attribute_id),
          CONSTRAINT fk_card_attribute_assignments_card
            FOREIGN KEY (card_id) REFERENCES card_master(id) ON DELETE CASCADE,
          CONSTRAINT fk_card_attribute_assignments_attribute
            FOREIGN KEY (attribute_id) REFERENCES card_attribute_library(id) ON DELETE CASCADE
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);

      const timestamp = toMysqlDateTime(new Date())!;
      for (const label of DEFAULT_ATTRIBUTE_SEED) {
        await db.execute(
          `
            INSERT INTO card_attribute_library (slug, label, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              label = VALUES(label),
              updated_at = VALUES(updated_at)
          `,
          [toSlug(label), label, timestamp, timestamp],
        );
      }

      for (const label of DEFAULT_SERIES_SEED) {
        await db.execute(
          `
            INSERT INTO card_series_library (slug, name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              updated_at = VALUES(updated_at)
          `,
          [toSlug(label) || `series-${label}`, label, timestamp, timestamp],
        );
      }
    })();

    return schemaReady;
  }

  async function listAttributes(): Promise<ControlledLibraryItem[]> {
    await ensureSchema();
    const db = await getPool();
    const [rows] = await db.query(
      `
        SELECT id, slug, label
        FROM card_attribute_library
        ORDER BY label COLLATE utf8mb4_unicode_ci ASC
      `,
    );

    return (rows as Array<{ id: number; slug: string; label: string }>).map((item) => ({
      id: item.id,
      slug: item.slug,
      label: item.label,
    }));
  }

  async function listSeries(): Promise<ControlledLibraryItem[]> {
    await ensureSchema();
    const db = await getPool();
    const [rows] = await db.query(
      `
        SELECT id, slug, name
        FROM card_series_library
        ORDER BY name COLLATE utf8mb4_unicode_ci ASC
      `,
    );

    return (rows as Array<{ id: number; slug: string; name: string }>).map((item) => ({
      id: item.id,
      slug: item.slug,
      label: item.name,
    }));
  }

  async function listCardMetadata(): Promise<CardMetadataRecord[]> {
    await ensureSchema();
    const db = await getPool();
    const [rows] = await db.query(listCardsSql);
    return (rows as CardRow[]).map(mapCardRow);
  }

  async function saveCard(payload: SaveCardPayload): Promise<CardMetadataRecord> {
    await ensureSchema();
    const db = await getPool();
    const connection = await db.getConnection();
    const timestamp = toMysqlDateTime(new Date())!;
    const title = normalizeText(payload.title);
    const description = normalizeText(payload.description);
    const selectedSeriesNames = splitSeriesNames(payload.seriesName);
    const seriesName = joinSeriesNames(selectedSeriesNames);
    const reviewStatus = payload.reviewStatus === 'reviewed' ? 'reviewed' : 'untagged';
    const editionSize = normalizeNumber(payload.editionSize);
    const uniqueAttributes = Array.from(
      new Set((payload.attributes || []).map((item) => normalizeText(item)).filter(Boolean)),
    );

    try {
      await connection.beginTransaction();

      const [existingRows] = await connection.execute(
        `
          SELECT id, card_uid
          FROM card_master
          WHERE image_path = ?
          LIMIT 1
          FOR UPDATE
        `,
        [payload.imagePath],
      );
      const existing = Array.isArray(existingRows) ? (existingRows[0] as { id: number; card_uid: string | null } | undefined) : undefined;

      let cardId = existing?.id ?? null;
      let cardUid = existing?.card_uid ?? null;

      if (!cardId) {
        const [insertResult] = await connection.execute<mysql.ResultSetHeader>(
          `
            INSERT INTO card_master (
              image_path,
              image_code,
              folder_path,
              title,
              description,
              rarity,
              series_name,
              edition_size,
              review_status,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            payload.imagePath,
            payload.imageCode,
            payload.folderPath,
            title || null,
            description || null,
            payload.rarity || null,
            seriesName || null,
            editionSize,
            reviewStatus,
            timestamp,
            timestamp,
          ],
        );
        cardId = insertResult.insertId;
        cardUid = `APH-${String(cardId).padStart(7, '0')}`;
        await connection.execute(
          'UPDATE card_master SET card_uid = ? WHERE id = ?',
          [cardUid, cardId],
        );
      } else {
        await connection.execute(
          `
            UPDATE card_master
            SET image_code = ?,
                folder_path = ?,
                title = ?,
                description = ?,
                rarity = ?,
                series_name = ?,
                edition_size = ?,
                review_status = ?,
                updated_at = ?
            WHERE id = ?
          `,
          [
            payload.imageCode,
            payload.folderPath,
            title || null,
            description || null,
            payload.rarity || null,
            seriesName || null,
            editionSize,
            reviewStatus,
            timestamp,
            cardId,
          ],
        );
      }

      for (const selectedSeriesName of selectedSeriesNames) {
        await connection.execute(
          `
            INSERT INTO card_series_library (slug, name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              updated_at = VALUES(updated_at)
          `,
          [toSlug(selectedSeriesName) || `series-${Date.now()}`, selectedSeriesName, timestamp, timestamp],
        );
      }

      await connection.execute(
        'DELETE FROM card_attribute_assignments WHERE card_id = ?',
        [cardId],
      );

      for (const label of uniqueAttributes) {
        const slug = toSlug(label) || `attribute-${Date.now()}`;
        await connection.execute(
          `
            INSERT INTO card_attribute_library (slug, label, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              label = VALUES(label),
              updated_at = VALUES(updated_at)
          `,
          [slug, label, timestamp, timestamp],
        );

        const [attributeRows] = await connection.execute(
          'SELECT id FROM card_attribute_library WHERE slug = ? LIMIT 1',
          [slug],
        );
        const attributeId = Array.isArray(attributeRows) ? (attributeRows[0] as { id: number } | undefined)?.id : undefined;
        if (attributeId) {
          await connection.execute(
            `
              INSERT IGNORE INTO card_attribute_assignments (card_id, attribute_id)
              VALUES (?, ?)
            `,
            [cardId, attributeId],
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const dbAfter = await getPool();
    const [rows] = await dbAfter.execute(
      `
        ${listCardsSql}
        HAVING image_path = ?
      `,
      [payload.imagePath],
    );
    const row = Array.isArray(rows) ? (rows[0] as CardRow | undefined) : undefined;
    if (!row) {
      throw new Error(`Card metadata was not persisted for ${payload.imagePath}`);
    }
    return mapCardRow(row);
  }

  async function createAttribute(label: string): Promise<ControlledLibraryItem[]> {
    await ensureSchema();
    const db = await getPool();
    const cleaned = normalizeText(label);
    if (!cleaned) {
      throw new Error('Attribute label is required.');
    }

    const timestamp = toMysqlDateTime(new Date())!;
    await db.execute(
      `
        INSERT INTO card_attribute_library (slug, label, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          label = VALUES(label),
          updated_at = VALUES(updated_at)
      `,
      [toSlug(cleaned) || `attribute-${Date.now()}`, cleaned, timestamp, timestamp],
    );

    return listAttributes();
  }

  async function renameAttribute(id: number, label: string): Promise<ControlledLibraryItem[]> {
    await ensureSchema();
    const db = await getPool();
    const cleaned = normalizeText(label);
    if (!cleaned) {
      throw new Error('Attribute label is required.');
    }

    await db.execute(
      `
        UPDATE card_attribute_library
        SET slug = ?, label = ?, updated_at = ?
        WHERE id = ?
      `,
      [toSlug(cleaned) || `attribute-${id}`, cleaned, toMysqlDateTime(new Date()), id],
    );
    return listAttributes();
  }

  async function deleteAttribute(id: number): Promise<ControlledLibraryItem[]> {
    await ensureSchema();
    const db = await getPool();
    await db.execute('DELETE FROM card_attribute_library WHERE id = ?', [id]);
    return listAttributes();
  }

  async function createSeries(name: string): Promise<ControlledLibraryItem[]> {
    await ensureSchema();
    const db = await getPool();
    const cleaned = normalizeText(name);
    if (!cleaned) {
      throw new Error('Series name is required.');
    }

    const timestamp = toMysqlDateTime(new Date())!;
    await db.execute(
      `
        INSERT INTO card_series_library (slug, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          updated_at = VALUES(updated_at)
      `,
      [toSlug(cleaned) || `series-${Date.now()}`, cleaned, timestamp, timestamp],
    );
    return listSeries();
  }

  async function renameSeries(id: number, name: string, previousName: string): Promise<ControlledLibraryItem[]> {
    await ensureSchema();
    const db = await getPool();
    const cleaned = normalizeText(name);
    if (!cleaned) {
      throw new Error('Series name is required.');
    }

    const timestamp = toMysqlDateTime(new Date())!;
    await db.execute(
      `
        UPDATE card_series_library
        SET slug = ?, name = ?, updated_at = ?
        WHERE id = ?
      `,
      [toSlug(cleaned) || `series-${id}`, cleaned, timestamp, id],
    );
    await db.execute(
      `
        UPDATE card_master
        SET series_name = ?, updated_at = ?
        WHERE series_name = ?
      `,
      [cleaned, timestamp, normalizeText(previousName)],
    );
    const previous = normalizeText(previousName);
    const [cardRows] = await db.query('SELECT id, series_name FROM card_master WHERE series_name IS NOT NULL');
    for (const row of cardRows as Array<{ id: number; series_name: string | null }>) {
      const nextSeriesName = joinSeriesNames(splitSeriesNames(row.series_name).map((item) => (item === previous ? cleaned : item)));
      if (nextSeriesName !== normalizeText(row.series_name)) {
        await db.execute(
          'UPDATE card_master SET series_name = ?, updated_at = ? WHERE id = ?',
          [nextSeriesName || null, timestamp, row.id],
        );
      }
    }
    return listSeries();
  }

  async function deleteSeries(id: number, name: string): Promise<ControlledLibraryItem[]> {
    await ensureSchema();
    const db = await getPool();
    const timestamp = toMysqlDateTime(new Date())!;
    await db.execute(
      `
        UPDATE card_master
        SET series_name = NULL, updated_at = ?
        WHERE series_name = ?
      `,
      [timestamp, normalizeText(name)],
    );
    const cleaned = normalizeText(name);
    const [cardRows] = await db.query('SELECT id, series_name FROM card_master WHERE series_name IS NOT NULL');
    for (const row of cardRows as Array<{ id: number; series_name: string | null }>) {
      const nextSeriesName = joinSeriesNames(splitSeriesNames(row.series_name).filter((item) => item !== cleaned));
      if (nextSeriesName !== normalizeText(row.series_name)) {
        await db.execute(
          'UPDATE card_master SET series_name = ?, updated_at = ? WHERE id = ?',
          [nextSeriesName || null, timestamp, row.id],
        );
      }
    }
    await db.execute('DELETE FROM card_series_library WHERE id = ?', [id]);
    return listSeries();
  }

  async function getStatus() {
    if (!config) {
      return {
        configured: false,
        connected: false,
        storage: 'mysql',
        database: null,
      };
    }

    try {
      const db = await getPool();
      await db.query('SELECT 1');
      return {
        configured: true,
        connected: true,
        storage: 'mysql',
        database: config.database,
      };
    } catch {
      return {
        configured: true,
        connected: false,
        storage: 'mysql',
        database: config.database,
      };
    }
  }

  return {
    isConfigured: () => Boolean(config),
    getStatus,
    listAttributes,
    listSeries,
    listCardMetadata,
    saveCard,
    createAttribute,
    renameAttribute,
    deleteAttribute,
    createSeries,
    renameSeries,
    deleteSeries,
  };
}
