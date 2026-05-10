import { useState, useEffect } from 'react';
import { imageUrl } from '../imageUrl.js';

export default function NoteModal({ note, collections, onClose, onDelete, onMove }) {
  const [imgIdx, setImgIdx] = useState(0);
  const total = note.images.length;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setImgIdx((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setImgIdx((i) => Math.min(total - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [total, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl overflow-hidden shadow-2xl flex w-full max-w-4xl max-h-[90vh]"
        style={{ minHeight: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left: image gallery ── */}
        <div className="relative bg-black flex-shrink-0 flex flex-col" style={{ width: '52%' }}>
          {total > 0 ? (
            <img
              key={imgIdx}
              src={imageUrl(note.images[imgIdx])}
              alt=""
              className="w-full h-full object-contain"
              style={{ maxHeight: '90vh' }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              无图片
            </div>
          )}

          {/* prev / next */}
          {total > 1 && (
            <>
              <button
                disabled={imgIdx === 0}
                onClick={() => setImgIdx((i) => i - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white text-xl flex items-center justify-center hover:bg-black/70 disabled:opacity-20 transition"
              >‹</button>
              <button
                disabled={imgIdx === total - 1}
                onClick={() => setImgIdx((i) => i + 1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white text-xl flex items-center justify-center hover:bg-black/70 disabled:opacity-20 transition"
              >›</button>
            </>
          )}

          {/* dots */}
          {total > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {note.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    i === imgIdx ? 'bg-white scale-125' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}

          {/* count badge */}
          {total > 1 && (
            <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
              {imgIdx + 1} / {total}
            </div>
          )}
        </div>

        {/* ── Right: content ── */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          {/* header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
            <span className="text-xs text-gray-400">
              {new Date(note.created_at).toLocaleDateString('zh-CN')}
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
            >✕</button>
          </div>

          {/* scrollable body */}
          <div className="overflow-y-auto flex-1 px-5 py-4">
            <h2 className="text-base font-bold text-gray-900 leading-snug mb-3">
              {note.title}
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">
              {note.content}
            </p>
            {note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-0.5 bg-red-50 text-[#ff2442] text-xs rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4">
              <label className="block text-xs text-gray-400 mb-1">合集</label>
              <select
                value={note.collection || ''}
                onChange={(e) => onMove(note.id, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 outline-none focus:border-[#ff2442]"
              >
                <option value="">未归入合集</option>
                {collections.map((collection) => (
                  <option key={collection} value={collection}>
                    {collection}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* footer */}
          <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 flex-shrink-0">
            <a
              href={note.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#ff2442] hover:underline"
            >
              查看原文 →
            </a>
            <div className="flex-1" />
            <button
              onClick={() => {
                if (confirm('确定删除这条笔记？')) onDelete(note.id);
              }}
              className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
