import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3001;
const DB_PATH = join(__dirname, 'library.db');

// ── Init SQL.js ───────────────────────────────────────────────────────────────
const SQL = await initSqlJs();
const db = existsSync(DB_PATH)
  ? new SQL.Database(readFileSync(DB_PATH))
  : new SQL.Database();

const persist = () => writeFileSync(DB_PATH, Buffer.from(db.export()));

db.run(`
  CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL DEFAULT '',
    content    TEXT    NOT NULL DEFAULT '',
    images     TEXT    NOT NULL DEFAULT '[]',
    tags       TEXT    NOT NULL DEFAULT '[]',
    url        TEXT    NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT (datetime('now','localtime'))
  )
`);
persist();

// Helper: run a SELECT and return plain objects
function query(sql, params = []) {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Serve built frontend in production
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function fetchImageBase64(url) {
  try {
    const { data, headers } = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        Referer: 'https://www.xiaohongshu.com/',
        Origin: 'https://www.xiaohongshu.com',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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
        messages: [
          {
            role: 'user',
            content: `以下是一篇小红书笔记，请提取 3-5 个中文标签词，只返回 JSON 数组，例如 ["护肤","平价好物"]。标题：${title}，内容：${content}`,
          },
        ],
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
    const text = data.choices[0].message.content.trim();
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {
    console.error('[tags] failed:', e.message);
  }
  return [];
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /import
app.post('/import', async (req, res) => {
  const { title = '', content = '', images = [], url = '' } = req.body;
  console.log(`[import] "${title}" — ${images.length} images`);

  const [base64Images, tags] = await Promise.all([
    Promise.all(images.map(fetchImageBase64)).then((r) => r.filter(Boolean)),
    generateTags(title, content),
  ]);

  db.run(
    'INSERT INTO notes (title, content, images, tags, url) VALUES (?, ?, ?, ?, ?)',
    [title, content, JSON.stringify(base64Images), JSON.stringify(tags), url]
  );
  const [{ id }] = query('SELECT last_insert_rowid() AS id');
  persist();

  console.log(`[import] saved id=${id}, tags=${tags.join(',')}`);
  res.json({ success: true, id, tags });
});

// GET /notes?search=&tag=
app.get('/notes', (req, res) => {
  const { search, tag } = req.query;
  const conds = [];
  const params = [];

  if (search) {
    conds.push('(title LIKE ? OR content LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (tag) {
    conds.push("tags LIKE ?");
    params.push(`%"${tag}"%`);
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = query(
    `SELECT * FROM notes ${where} ORDER BY created_at DESC`,
    params
  );

  res.json(
    rows.map((r) => ({
      ...r,
      images: JSON.parse(r.images),
      tags: JSON.parse(r.tags),
    }))
  );
});

// DELETE /notes/:id
app.delete('/notes/:id', (req, res) => {
  db.run('DELETE FROM notes WHERE id = ?', [Number(req.params.id)]);
  persist();
  res.json({ success: true });
});

// GET /tags
app.get('/tags', (req, res) => {
  const rows = query('SELECT tags FROM notes');
  const all = new Set();
  rows.forEach((r) => JSON.parse(r.tags).forEach((t) => all.add(t)));
  res.json([...all]);
});

// SPA fallback
if (existsSync(distPath)) {
  app.get('*', (_, res) => res.sendFile(join(distPath, 'index.html')));
}

app.listen(PORT, () =>
  console.log(`✅  Server: http://localhost:${PORT}`)
);
