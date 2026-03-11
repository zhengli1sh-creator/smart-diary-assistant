'use client';

import { useState } from 'react';
import { RefreshCw, Calendar, Loader2 } from 'lucide-react';

export default function ManualExtractButton() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleExtract = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      const response = await fetch(`/api/cron/extract-memories?date=${date}`, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}`
        }
      });
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        window.location.reload(); // Refresh to show new memories
      } else {
        alert('提取失败，请重试');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      alert('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-purple-100 bg-gradient-to-r from-purple-50/50 to-white">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-purple-700 font-medium text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>手动补录记忆总结</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium"
            />
          </div>
          
          <button
            onClick={handleExtract}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-sm
              ${loading 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95'
              }`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? '正在提取...' : success ? '提取成功!' : '开始总结'}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 ml-1">
          提示：如果你发现某天的日记没有被总结，可以在此处手动触发。
        </p>
      </div>
    </div>
  );
}
