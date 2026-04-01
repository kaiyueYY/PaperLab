// src/App.tsx

import { WorkflowProvider } from './components/WorkflowContext'
import FlowCanvas from './components/FlowCanvas'
import Sidebar from './components/Sidebar'

function AppInner() {
  const pageStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateRows: '48px 1fr 200px',
    height: '100vh',
    overflow: 'hidden',
  }

  const topBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    borderBottom: '1px solid #e5e5e5',
    background: '#ffffff',
  }

  const middleRowStyle: React.CSSProperties = {
    display: 'flex',
    overflow: 'hidden',
  }

  const sidebarStyle: React.CSSProperties = {
    width: 200,
    flexShrink: 0,
    borderRight: '1px solid #e5e5e5',
    background: '#f9f9f9',
    overflowY: 'auto',
  }

  const canvasStyle: React.CSSProperties = {
    flex: 1,
    position: 'relative',
  }

  const rightPanelStyle: React.CSSProperties = {
    width: 280,
    flexShrink: 0,
    borderLeft: '1px solid #e5e5e5',
    background: '#ffffff',
    padding: 12,
  }

  const bottomPanelStyle: React.CSSProperties = {
    borderTop: '1px solid #e5e5e5',
    background: '#fafafa',
    padding: '12px 16px',
    overflowY: 'auto',
  }

  return (
    <div style={pageStyle}>
      {/* 顶部栏 */}
      <header style={topBarStyle}>
        <span style={{ fontWeight: 600, fontSize: 16 }}>📄 PaperLab</span>
        <button style={{ padding: '6px 16px', cursor: 'pointer' }}>
          运行
        </button>
      </header>

      {/* 中间行 */}
      <div style={middleRowStyle}>
        <aside style={sidebarStyle}>
          <Sidebar />
        </aside>

        <main style={canvasStyle}>
          <FlowCanvas />
        </main>

        <aside style={rightPanelStyle}>
          <p style={{ fontSize: 13, color: '#999' }}>参数面板（占位）</p>
        </aside>
      </div>

      {/* 底部结果面板 */}
      <footer style={bottomPanelStyle}>
        <p style={{ fontSize: 13, color: '#999' }}>结果面板（占位）</p>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <WorkflowProvider>
      <AppInner />
    </WorkflowProvider>
  )
}
