import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Send, Loader2 } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { taskStore, Task } from '../store/taskStore';
import TaskModal from '../components/TaskModal';
import TaskResultModal from '../components/TaskResultModal';

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  const [originalInputText, setOriginalInputText] = useState('');
  
  const { tasks, fetchTasks, parseAndCreateTasks, deleteTask } = taskStore();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) {
      toast.error('请输入任务描述');
      return;
    }

    setIsLoading(true);
    const currentInputText = inputText;
    try {
      const newTasks = await parseAndCreateTasks(inputText);
      setInputText('');
      
      // 显示任务创建结果
      setCreatedTasks(newTasks);
      setOriginalInputText(currentInputText);
      setShowResultModal(true);
      
      toast.success(`成功创建了 ${newTasks.length} 个任务！`);
    } catch (error) {
      toast.error('创建任务失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEventClick = (clickInfo: any) => {
    const task = tasks.find(t => t.id === clickInfo.event.id);
    if (task) {
      setSelectedTask(task);
      setShowModal(true);
    }
  };

  const handleDateClick = (dateClickInfo: any) => {
    // 点击日期创建新任务
    setSelectedTask({
      start: dateClickInfo.date,
      end: new Date(dateClickInfo.date.getTime() + 60 * 60 * 1000), // 默认1小时
      priority: 'medium'
    });
    setShowModal(true);
  };

  const calendarEvents = tasks.map(task => ({
    id: task.id,
    title: task.title,
    start: task.start,
    end: task.end,
    backgroundColor: task.priority === 'high' ? '#ef4444' : 
                    task.priority === 'medium' ? '#f59e0b' : '#10b981',
    borderColor: task.priority === 'high' ? '#dc2626' : 
                task.priority === 'medium' ? '#d97706' : '#059669'
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* 头部标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
            <Calendar className="text-blue-600" size={40} />
            智能任务管理系统
          </h1>
          <p className="text-gray-600 text-lg">用自然语言描述您的任务，AI 将自动为您安排日程</p>
        </div>

        {/* 任务输入区域 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col space-y-4">
              <label htmlFor="taskInput" className="text-lg font-semibold text-gray-700">
                描述您的任务
              </label>
              <textarea
                id="taskInput"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="例如：明天上午9点开会，下午写项目报告，周五下午3点和客户见面..."
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                disabled={isLoading}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <Plus size={20} />
                手动添加
              </button>
              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Send size={20} />
                )}
                {isLoading ? '解析中...' : 'AI 解析任务'}
              </button>
            </div>
          </form>
        </div>

        {/* 日历展示区域 */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            events={calendarEvents}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            height="auto"
            locale="zh-cn"
            buttonText={{
              today: '今天',
              month: '月',
              week: '周',
              day: '日'
            }}
            dayMaxEvents={3}
            moreLinkText="更多"
            eventDisplay="block"
            displayEventTime={true}
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }}
          />
        </div>
      </div>

      {/* 任务编辑模态框 */}
      {showModal && (
        <TaskModal
          task={selectedTask}
          onClose={() => {
            setShowModal(false);
            setSelectedTask(null);
          }}
          onSave={() => {
            setShowModal(false);
            setSelectedTask(null);
            fetchTasks();
          }}
        />
      )}

      {/* 任务创建结果模态框 */}
      {showResultModal && (
        <TaskResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          createdTasks={createdTasks}
          originalText={originalInputText}
        />
      )}

      {/* Toast 通知 */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
}