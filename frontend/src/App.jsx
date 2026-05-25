import { useState, useEffect, Component } from 'react';
import Sidebar from './components/Sidebar';
import Checks from './components/Checks';
import RadarTab from './components/RadarTab';
import RiskReport from './components/RiskReport';
import TopBar from './components/TopBar';

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#6B7A90' }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Nie udało się załadować widoku.</div>
          <button onClick={() => this.setState({ error: null })} style={{ fontSize: 12, color: '#005BAC', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Spróbuj ponownie
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats]             = useState(null);
  const [activeTab, setActiveTab]     = useState('checks');
  const [selectedReg, setSelectedReg]           = useState(null);
  const [selectedOperator, setSelectedOperator] = useState(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => setStats(data))
      .catch(() => {});
  }, []);

  function handleNavigate(tab, reg = null, operator = null) {
    setActiveTab(tab);
    if (reg) setSelectedReg(reg);
    if (operator) setSelectedOperator(operator);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white w-full">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        stats={stats}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          onMenuToggle={() => setSidebarOpen(v => !v)}
          activeTab={activeTab}
        />
        <main
          style={{
            flex: 1, minHeight: 0,
            display: 'flex', flexDirection: 'column',
            overflow: activeTab === 'radar' ? 'hidden' : 'auto',
          }}
          id="main-content"
          tabIndex={-1}
        >
          {activeTab === 'checks' && (
            <div className="tab-content" style={{ flex: 1 }}>
              <Checks
                stats={stats}
                selectedReg={selectedReg}
                onClearSelectedReg={() => setSelectedReg(null)}
                selectedOperator={selectedOperator}
                onClearSelectedOperator={() => setSelectedOperator(null)}
              />
            </div>
          )}
          {activeTab === 'radar' && (
            <ErrorBoundary key="radar">
              <RadarTab onNavigate={handleNavigate} />
            </ErrorBoundary>
          )}
          {activeTab === 'risk' && (
            <div className="tab-content" style={{ flex: 1 }}>
              <RiskReport />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
