import { useState } from 'react';

export default function CollectionFilter({
  collections,
  selected,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}) {
  const [name, setName] = useState('');

  const create = () => {
    const next = name.trim();
    if (!next) return;
    onCreate(next);
    onSelect(next);
    setName('');
  };

  const rename = (collection) => {
    const next = prompt('重命名合集', collection)?.trim();
    if (!next || next === collection) return;
    onRename(collection, next);
  };

  const remove = (collection) => {
    if (!confirm(`删除合集「${collection}」？合集里的笔记会移回“未归入合集”。`)) return;
    onDelete(collection);
  };

  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
        合集
      </h3>
      <div className="space-y-0.5 mb-2">
        <button
          onClick={() => onSelect('')}
          className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
            selected === ''
              ? 'bg-[#ff2442] text-white font-medium'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          全部
        </button>
        {collections.map((collection) => (
          <div key={collection} className="group flex items-center gap-1">
            <button
              onClick={() => onSelect(collection === selected ? '' : collection)}
              className={`min-w-0 flex-1 text-left px-3 py-1.5 rounded-lg text-sm truncate transition-colors ${
                selected === collection
                  ? 'bg-[#ff2442] text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
              title={collection}
            >
              {collection}
            </button>
            <button
              onClick={() => rename(collection)}
              className="px-1.5 py-1 rounded text-[11px] text-gray-400 hover:text-gray-700 hover:bg-gray-200"
              title="重命名"
            >
              改
            </button>
            <button
              onClick={() => remove(collection)}
              className="px-1.5 py-1 rounded text-[11px] text-gray-400 hover:text-red-500 hover:bg-red-50"
              title="删除"
            >
              删
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') create();
          }}
          placeholder="新合集"
          className="min-w-0 flex-1 px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-xs outline-none focus:border-[#ff2442]"
        />
        <button
          onClick={create}
          className="px-2 py-1.5 rounded-lg bg-gray-900 text-white text-xs hover:bg-black"
        >
          +
        </button>
      </div>
    </div>
  );
}
