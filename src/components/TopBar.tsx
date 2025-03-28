import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Settings, Book, MessageSquare, Zap, Key, BarChart3, DollarSign, Plus } from 'lucide-react';

interface TopBarProps {
  onMenuClick: () => void;
}

const menuItems = [
  { icon: Key, label: 'Add Auth' },
  { icon: Zap, label: 'Your Triggers' },
  { icon: BarChart3, label: 'Workflow Logs' },
  { icon: Book, label: 'Documentation' },
  { icon: MessageSquare, label: 'Feedback' },
  { icon: DollarSign, label: 'Plans and Usage' },
  { icon: Settings, label: 'Your Collections' },
  { icon: Plus, label: 'Create Tool' },
];

export default function TopBar({ onMenuClick }: TopBarProps) {
  const navigate = useNavigate();

  // Open Create Tool Page
  const handleCreateTool = () => {
    navigate('/create-tool');
  };

  // Navigate to Manage Auths Page
  const handleManageAuths = () => {
    navigate('/manage-auths');
  };

  return (
    <div className="fixed top-0 left-0 right-0 bg-gray-800 border-b border-gray-700 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <button onClick={onMenuClick} className="p-2 hover:bg-gray-700 rounded">
          <Menu size={25} />
        </button>

        <div className="flex items-center gap-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              className="p-2 hover:bg-gray-700 rounded"
              title={item.label}
              onClick={
                item.label === 'Add Auth'
                  ? handleManageAuths
                  : item.label === 'Create Tool'
                  ? handleCreateTool
                  : undefined
              }
            >
              <item.icon size={20} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
