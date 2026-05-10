import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { Pool } from 'pg';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';

dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

async function createPoolConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return { ssl: false };

  try {
    const url = new URL(connectionString);
    const [ipv4] = await dns.promises.resolve4(url.hostname);
    if (ipv4) {
      console.log(`[db] using IPv4 ${ipv4} for ${url.hostname}`);
      url.hostname = ipv4;
      return {
        connectionString: url.toString(),
        ssl: { rejectUnauthorized: false },
      };
    }
  } catch (e) {
    console.warn('[db] IPv4 resolution failed, using original DATABASE_URL:', e.message);
  }

  return {
    connectionString,
    ssl: { rejectUnauthorized: false },
  };
}

const pool = new Pool(await createPoolConfig());

process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[process] uncaught exception:', error);
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id         SERIAL PRIMARY KEY,
        title      TEXT    NOT NULL DEFAULT '',
        content    TEXT    NOT NULL DEFAULT '',
        images     TEXT    NOT NULL DEFAULT '[]',
        videos     TEXT    NOT NULL DEFAULT '[]',
        tags       TEXT    NOT NULL DEFAULT '[]',
        collection TEXT    NOT NULL DEFAULT '',
        url        TEXT    NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query("ALTER TABLE notes ADD COLUMN IF NOT EXISTS collection TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE notes ADD COLUMN IF NOT EXISTS videos TEXT NOT NULL DEFAULT '[]'");
    await client.query(`
      CREATE TABLE IF NOT EXISTS collections (
        name       TEXT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Database initialized');
  } finally {
    client.release();
  }
}

initDb().catch((e) => {
  console.error('[db] init failed:', e.message);
});

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];

  const seen = new Set();
  return images
    .filter((url) => typeof url === 'string')
    .map((url) => url.trim())
    .filter((url) => url && !url.endsWith('base64,'))
    .filter((url) => /^https?:\/\//i.test(url) || /^data:image\/[a-z0-9.+-]+;base64,/i.test(url))
    .filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, 30);
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeVideos(videos) {
  if (!Array.isArray(videos)) return [];

  const seen = new Set();
  return videos
    .filter((url) => typeof url === 'string')
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, 5);
}

async function generateTags(title, content) {
  const key = process.env.SILICONFLOW_API_KEY;
  if (!key) return [];

  try {
    const { data } = await axios.post(
      'https://api.siliconflow.cn/v1/chat/completions',
      {
        model: 'deepseek-ai/DeepSeek-V3',
        messages: [{
          role: 'user',
          content: `以下是一篇小红书笔记，请提取 3-5 个中文标签词，只返回 JSON 数组，例如 ["护肤","平价好物"]。标题：${title}，内容：${content}`,
        }],
        max_tokens: 120,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const text = data.choices?.[0]?.message?.content?.trim() || '';
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {
    console.error('[tags] failed:', e.message);
  }

  return [];
}

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/import', async (req, res) => {
  const { title = '', content = '', images = [], videos = [], url = '' } = req.body;
  const cleanImages = normalizeImages(images);
  const cleanVideos = normalizeVideos(videos);
  console.log(`[import] "${title}" - ${cleanImages.length} images, ${cleanVideos.length} videos`);

  const tags = await generateTags(title, content);
  let client;

  try {
    client = await pool.connect();
    const result = await client.query(
      'INSERT INTO notes (title, content, images, videos, tags, url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [title, content, JSON.stringify(cleanImages), JSON.stringify(cleanVideos), JSON.stringify(tags), url]
    );
    console.log(`[import] saved id=${result.rows[0].id}, tags=${tags.join(',')}`);
    res.json({ success: true, id: result.rows[0].id, tags, images: cleanImages.length, videos: cleanVideos.length });
  } catch (e) {
    console.error('[import] error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client?.release();
  }
});

app.get('/notes', async (req, res) => {
  const { search, tag, collection } = req.query;
  let sql = `
    SELECT
      id,
      title,
      content,
      CASE WHEN length(images) > 1000000 THEN '[]' ELSE images END AS images,
      videos,
      tags,
      collection,
      url,
      created_at
    FROM notes
  `;
  const params = [];
  const conditions = [];

  if (search) {
    conditions.push(`(title ILIKE $${params.length + 1} OR content ILIKE $${params.length + 1})`);
    params.push(`%${search}%`);
  }
  if (tag) {
    conditions.push(`tags ILIKE $${params.length + 1}`);
    params.push(`%"${tag}"%`);
  }
  if (collection) {
    conditions.push(`collection = $${params.length + 1}`);
    params.push(collection);
  }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';

  let client;
  try {
    client = await pool.connect();
    const result = await client.query(sql, params);
    res.json(result.rows.map((row) => ({
      ...row,
      images: parseJsonArray(row.images),
      videos: parseJsonArray(row.videos),
      tags: parseJsonArray(row.tags),
    })));
  } catch (e) {
    console.error('[notes] error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client?.release();
  }
});

app.patch('/notes/:id/collection', async (req, res) => {
  const collection = String(req.body?.collection || '').trim().slice(0, 80);
  let client;
  try {
    client = await pool.connect();
    if (collection) {
      await client.query(
        'INSERT INTO collections (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [collection]
      );
    }
    const result = await client.query(
      'UPDATE notes SET collection = $1 WHERE id = $2 RETURNING id, collection',
      [collection, Number(req.params.id)]
    );
    if (!result.rowCount) {
      res.status(404).json({ success: false, error: 'Note not found' });
      return;
    }
    res.json({ success: true, ...result.rows[0] });
  } catch (e) {
    console.error('[collection] error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client?.release();
  }
});

app.get('/collections', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `
        SELECT name FROM collections
        UNION
        SELECT DISTINCT collection AS name FROM notes WHERE collection <> ''
        ORDER BY name ASC
      `
    );
    res.json(result.rows.map((row) => row.name));
  } catch (e) {
    console.error('[collections] error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client?.release();
  }
});

app.post('/collections', async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 80);
  if (!name) {
    res.status(400).json({ success: false, error: 'Collection name is required' });
    return;
  }

  let client;
  try {
    client = await pool.connect();
    await client.query(
      'INSERT INTO collections (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name]
    );
    res.json({ success: true, name });
  } catch (e) {
    console.error('[collections] create error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client?.release();
  }
});

app.patch('/collections/:name', async (req, res) => {
  const oldName = String(req.params.name || '').trim().slice(0, 80);
  const newName = String(req.body?.name || '').trim().slice(0, 80);

  if (!oldName || !newName) {
    res.status(400).json({ success: false, error: 'Collection name is required' });
    return;
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO collections (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [newName]
    );
    await client.query('UPDATE notes SET collection = $1 WHERE collection = $2', [newName, oldName]);
    if (oldName !== newName) {
      await client.query('DELETE FROM collections WHERE name = $1', [oldName]);
    }
    await client.query('COMMIT');
    res.json({ success: true, name: newName });
  } catch (e) {
    await client?.query('ROLLBACK').catch(() => {});
    console.error('[collections] rename error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client?.release();
  }
});

app.delete('/collections/:name', async (req, res) => {
  const name = String(req.params.name || '').trim().slice(0, 80);
  if (!name) {
    res.status(400).json({ success: false, error: 'Collection name is required' });
    return;
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query("UPDATE notes SET collection = '' WHERE collection = $1", [name]);
    await client.query('DELETE FROM collections WHERE name = $1', [name]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client?.query('ROLLBACK').catch(() => {});
    console.error('[collections] delete error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client?.release();
  }
});

app.get('/image-proxy', async (req, res) => {
  const rawUrl = String(req.query.url || '');

  if (!/^https?:\/\//i.test(rawUrl)) {
    res.status(400).send('Invalid image URL');
    return;
  }

  try {
    const url = new URL(rawUrl);
    if (!/(^|\.)xhscdn\.com$|(^|\.)xiaohongshu\.com$/i.test(url.hostname)) {
      res.status(400).send('Unsupported image host');
      return;
    }

    const upstream = await axios.get(rawUrl, {
      responseType: 'stream',
      timeout: 20000,
      headers: {
        Referer: 'https://www.xiaohongshu.com/',
        Origin: 'https://www.xiaohongshu.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    res.setHeader('Content-Type', upstream.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    upstream.data.pipe(res);
  } catch (e) {
    console.error('[image-proxy] error:', e.message);
    res.status(502).send('Image fetch failed');
  }
});

app.delete('/notes/:id', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('DELETE FROM notes WHERE id = $1', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (e) {
    console.error('[delete] error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client?.release();
  }
});

app.get('/tags', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT tags FROM notes');
    const all = new Set();
    result.rows.forEach((row) => {
      parseJsonArray(row.tags).forEach((tag) => all.add(tag));
    });
    res.json([...all]);
  } catch (e) {
    console.error('[tags] error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client?.release();
  }
});

app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
