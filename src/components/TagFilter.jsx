export default function TagFilter({ tags, selected, onSelect }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
        标签
      </h3>
      <div className="space-y-0.5">
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
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => onSelect(tag === selected ? '' : tag)}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm truncate transition-colors ${
              selected === tag
                ? 'bg-[#ff2442] text-white font-medium'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            #{tag}
          </button>
        ))}
      </div>
    </div>
  );
}
