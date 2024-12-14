import { useWhiteboard } from '../context/WhiteboardContext';

export default function WhiteboardToolbar() {
  const { tool, setTool, color, setColor, width, setWidth, selectedShape, setSelectedShape } = useWhiteboard();

  return (
    <div className="fixed top-20 left-4 bg-white p-4 rounded-lg shadow-lg space-y-4">
      <div className="space-y-2">
        <button
          className={`w-full px-4 py-2 rounded ${
            tool === 'pen' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
          onClick={() => {
            setTool('pen');
            setSelectedShape(null);
          }}
        >
          ✏️ Pen
        </button>

        <button
          className={`w-full px-4 py-2 rounded ${
            tool === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
          onClick={() => {
            setTool('select');
            setSelectedShape(null);
          }}
        >
          ⭐ Select
        </button>

        <button
          className={`w-full px-4 py-2 rounded ${
            tool === 'shapes' && selectedShape === 'rectangle' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
          onClick={() => {
            setTool('shapes');
            setSelectedShape('rectangle');
          }}
        >
          ▭ Rectangle
        </button>

        <button
          className={`w-full px-4 py-2 rounded ${
            tool === 'shapes' && selectedShape === 'arrow' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
          onClick={() => {
            setTool('shapes');
            setSelectedShape('arrow');
          }}
        >
          ➜ Arrow
        </button>

        <button
          className={`w-full px-4 py-2 rounded ${
            tool === 'text' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
          onClick={() => {
            setTool('text');
            setSelectedShape(null);
          }}
        >
          T Text
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Color</label>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-full h-8 cursor-pointer"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Width: {width}
        </label>
        <input
          type="range"
          min="1"
          max="20"
          value={width}
          onChange={(e) => setWidth(parseInt(e.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
}
