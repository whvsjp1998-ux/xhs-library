import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { Pool } from 'pg';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
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
        tags       TEXT    NOT NULL DEFAULT '[]',
        url        TEXT    NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Database initialized');
  } finally {
    client.release();
  }
}

initDb();

async function fetchImageBase64(url) {
  try {
    const { data, headers } = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        Referer: 'https://www.xiaohongshu.com/',
        Origin: 'https://www.xiaohongshu.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'cross-site',
      },
    });
    const mime = (headers['content-type'] || 'image/jpeg').split(';')[0];
    return `data:${mime};base64,${Buffer.from(data).toString('base64')}`;
  } catch (e) {
    console.warn('[image] failed:', url.slice(0, 80), e.message);
    return null;
  }
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
          content: `以下是一篇小红书笔记，请提取 3-5 个中文标签词，只返回 JSON 数组，例如 ["护肤","平价好物"]。标题：${title}，内容：${content}`
        }],
        max_tokens: 120,
        temperature: 0.3,
      },
      { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, timeout: 20000 }
    );
    const text = data.choices[0].message.content.trim();
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {
    console.error('[tags] failed:', e.message);
  }
  return [];
}

app.post('/import', async (req, res) => {
  const { title = '', content = '', images = [], url = '' } = req.body;
  console.log(`[import] "${title}" — ${images.length} images`);

  const [base64Images, tags] = await Promise.all([
    Promise.all(images.map(fetchImageBase64)).then(r => r.filter(Boolean)),
    generateTags(title, content)
  ]);

  const client = await pool.connect();
  try {
    const result = await client.query(
      'INSERT INTO notes (title, content, images, tags, url) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [title, content, JSON.stringify(base64Images), JSON.stringify(tags), url]
    );
    console.log(`[import] saved id=${result.rows[0].id}, tags=${tags.join(',')}`);
    res.json({ success: true, id: result.rows[0].id, tags });
  } catch (e) {
    console.error('[import] error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

app.get('/notes', async (req, res) => {
  const { search, tag } = req.query;
  let sql = 'SELECT * FROM notes';
  const params = [];
  const conditions = [];

  if (search) {
    conditions.push(`(title ILIKE $${params.length + 1} OR content ILIKE $${params.length + 1})`);
    params.push(`%${search}%`);
    params.push(`%${search}%`);
  }
  if (tag) {
    conditions.push(`tags ILIKE $${params.length + 1}`);
    params.push(`%"${tag}"%`);
  }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';

  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    res.json(result.rows.map(r => ({
      ...r,
      images: JSON.parse(r.images),
      tags: JSON.parse(r.tags)
    })));
  } catch (e) {
    console.error('[notes] error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.delete('/notes/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM notes WHERE id = $1', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (e) {
    console.error('[delete] error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

app.get('/tags', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT tags FROM notes');
    const all = new Set();
    result.rows.forEach(r => JSON.parse(r.tags).forEach(t => all.add(t)));
    res.json([...all]);
  } catch (e) {
    console.error('[tags] error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => console.log(`✅ Server: http://localhost:${PORT}`));