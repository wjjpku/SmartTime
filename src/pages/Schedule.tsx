import React, { useState } from 'react';
import { Calendar, Clock, Brain, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface WorkInfo {
  title: string;
  description: string;
  duration_hours: number;
  deadline: string | null;
  priority: string;
  preferences: string[];
}

interface TimeSlot {
  start: string;
  end: string;
  score: number;
  reason: string;
}

interface AnalyzeResponse {
  success: boolean;
  work_info: WorkInfo | null;
  recommendations: TimeSlot[];
  error: string | null;
}

interface ConfirmResponse {
  success: boolean;
  task: any;
  error: string | null;
}

const Schedule: React.FC = () => {
  const [description, setDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [workInfo, setWorkInfo] = useState<WorkInfo | null>(null);
  const [recommendations, setRecommendations] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const handleAnalyze = async () => {
    if (!description.trim()) {
      toast.error('请输入工作描述');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/schedule/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      });

      const data: AnalyzeResponse = await response.json();
      
      if (data.success && data.work_info) {
        setWorkInfo(data.work_info);
        setRecommendations(data.recommendations);
        toast.success('智能分析完成！');
      } else {
        toast.error(data.error || '分析失败，请重试');
      }
    } catch (error) {
      console.error('分析失败:', error);
      toast.error('网络错误，请检查连接');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedSlot || !workInfo) {
      toast.error('请选择一个时间段');
      return;
    }

    setIsConfirming(true);
    try {
      const response = await fetch('/api/schedule/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          work_info: workInfo,
          selected_slot: selectedSlot,
        }),
      });

      const data: ConfirmResponse = await response.json();
      
      if (data.success) {
        toast.success('日程安排已确认！');
        // 重置状态
        setDescription('');
        setWorkInfo(null);
        setRecommendations([]);
        setSelectedSlot(null);
      } else {
        toast.error(data.error || '确认失败，请重试');
      }
    } catch (error) {
      console.error('确认失败:', error);
      toast.error('网络错误，请检查连接');
    } finally {
      setIsConfirming(false);
    }
  };

  const formatDateTime = (dateTimeStr: string) => {
    const date = new Date(dateTimeStr);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high':
        return '高优先级';
      case 'medium':
        return '中优先级';
      case 'low':
        return '低优先级';
      default:
        return '未知';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              智能日程安排
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            描述您的工作需求，AI 将为您推荐最佳的时间安排
          </p>
        </div>

        {/* 工作描述输入区 */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-800">工作描述</h2>
          </div>
          
          <div className="space-y-4">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请详细描述您的工作内容，包括：&#10;• 工作内容和预估时长&#10;• 截止日期（如有）&#10;• 时间偏好（如：上午、下午、安静环境等）&#10;&#10;例如：明天下午写一份项目报告，大概需要3小时"
              className="w-full h-32 p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
            
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !description.trim()}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-3"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  AI 正在分析中...
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5" />
                  开始智能分析
                </>
              )}
            </button>
          </div>
        </div>

        {/* 工作信息展示 */}
        {workInfo && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-semibold text-gray-800">工作信息</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">工作标题</label>
                  <p className="text-lg font-semibold text-gray-800">{workInfo.title}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">预估时长</label>
                  <p className="text-lg text-gray-800">{workInfo.duration_hours} 小时</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">优先级</label>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(workInfo.priority)}`}>
                    {getPriorityText(workInfo.priority)}
                  </span>
                </div>
                
                {workInfo.deadline && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">截止日期</label>
                    <p className="text-lg text-gray-800">{formatDateTime(workInfo.deadline)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 时间推荐卡片 */}
        {recommendations.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-800">推荐时间段</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendations.map((slot, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedSlot(slot)}
                  className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                    selectedSlot === slot
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-gray-800">时间段 {index + 1}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-blue-600">{slot.score}</span>
                      <span className="text-xs text-gray-500">分</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      {formatDateTime(slot.start)} - {formatDateTime(slot.end)}
                    </p>
                    <p className="text-sm text-gray-700">{slot.reason}</p>
                  </div>
                  
                  {selectedSlot === slot && (
                    <div className="mt-3 flex items-center gap-2 text-blue-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">已选择</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {selectedSlot && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={handleConfirm}
                  disabled={isConfirming}
                  className="w-full bg-gradient-to-r from-green-500 to-blue-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-green-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-3"
                >
                  {isConfirming ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      正在确认中...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      确认日程安排
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 空状态提示 */}
        {!workInfo && !isAnalyzing && (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">开始智能日程安排</h3>
            <p className="text-gray-500">
              在上方输入您的工作描述，AI 将为您分析并推荐最佳的时间安排
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Schedule;