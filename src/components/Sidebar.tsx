// src/components/Sidebar.tsx

const NODE_CARDS = [
  {
    type: 'input',
    label: '📄 文献输入',
    desc: '上传或粘贴文献列表',
    color: '#e8f4fd',
    border: '#90caf9',
  },
  {
    type: 'analysis',
    label: '🔍 智能分析',
    desc: '调用 AI 分析文献',
    color: '#e8f5e9',
    border: '#a5d6a7',
  },
  {
    type: 'outline',
    label: '📝 大纲生成',
    desc: '生成论文大纲结构',
    color: '#fff3e0',
    border: '#ffcc80',
  },
]

export default function Sidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    // 把节点类型存入 dataTransfer，FlowCanvas 的 onDrop 会读取它
    event.dataTransfer.setData('nodeType', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div style={{ padding: 12 }}>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
        拖拽节点到画布
      </p>

      {NODE_CARDS.map((card) => (
        <div
          key={card.type}
          draggable
          onDragStart={(e) => onDragStart(e, card.type)}
          style={{
            background: card.color,
            border: `1px solid ${card.border}`,
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 10,
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13 }}>{card.label}</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
            {card.desc}
          </div>
        </div>
      ))}
    </div>
  )
}
