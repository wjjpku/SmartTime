import React, { useState } from 'react';
import { Download, FileText, Table, Calendar, X, Loader2 } from 'lucide-react';
import { Task } from '../store/taskStore';
import { useNotification } from './NotificationManager';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

interface DataExportProps {
  tasks: Task[];
  onClose: () => void;
}

const DataExport: React.FC<DataExportProps> = ({ tasks, onClose }) => {
  const [isExporting, setIsExporting] = useState(false);
  const { showSuccess, showError } = useNotification();
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  // 根据日期范围筛选任务
  const getFilteredTasks = () => {
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999); // 设置为当天结束时间

    return tasks.filter(task => {
      const taskStart = new Date(task.start);
      return taskStart >= startDate && taskStart <= endDate;
    });
  };

  // 导出为PDF
  const exportToPDF = async () => {
    try {
      setIsExporting(true);
      const filteredTasks = getFilteredTasks();
      
      const pdf = new jsPDF();
      
      // 设置字体（支持中文）
      pdf.setFont('helvetica');
      
      // 标题
      pdf.setFontSize(20);
      pdf.text('SmartTime Task Report', 20, 30);
      
      // 日期范围
      pdf.setFontSize(12);
      pdf.text(`Export Date Range: ${dateRange.start} to ${dateRange.end}`, 20, 45);
      pdf.text(`Total Tasks: ${filteredTasks.length}`, 20, 55);
      
      // 任务列表
      let yPosition = 75;
      pdf.setFontSize(10);
      
      filteredTasks.forEach((task, index) => {
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = 30;
        }
        
        // 任务标题
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${index + 1}. ${task.title}`, 20, yPosition);
        yPosition += 10;
        
        // 任务详情
        pdf.setFont('helvetica', 'normal');
        const startTime = new Date(task.start).toLocaleString('zh-CN');
        pdf.text(`Start: ${startTime}`, 25, yPosition);
        yPosition += 8;
        
        if (task.end) {
          const endTime = new Date(task.end).toLocaleString('zh-CN');
          pdf.text(`End: ${endTime}`, 25, yPosition);
          yPosition += 8;
        }
        
        pdf.text(`Priority: ${task.priority}`, 25, yPosition);
        yPosition += 8;
        
        if (task.description) {
          pdf.text(`Description: ${task.description}`, 25, yPosition);
          yPosition += 8;
        }
        
        yPosition += 5; // 任务间距
      });
      
      // 保存PDF
      const fileName = `smarttime-tasks-${dateRange.start}-to-${dateRange.end}.pdf`;
      pdf.save(fileName);
      
      showSuccess('PDF导出成功', `已导出 ${filteredTasks.length} 个任务到 ${fileName}`);
      onClose();
      
    } catch (error) {
      console.error('PDF导出失败:', error);
      showError('PDF导出失败', '请检查浏览器设置并重试');
    } finally {
      setIsExporting(false);
    }
  };

  // 导出为Excel
  const exportToExcel = async () => {
    try {
      setIsExporting(true);
      const filteredTasks = getFilteredTasks();
      
      // 准备数据
      const excelData = filteredTasks.map((task, index) => ({
        '序号': index + 1,
        '任务标题': task.title,
        '开始时间': new Date(task.start).toLocaleString('zh-CN'),
        '结束时间': task.end ? new Date(task.end).toLocaleString('zh-CN') : '',
        '优先级': task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低',
        '重要程度': task.is_important ? '重要' : '普通',
        '提醒类型': task.reminder_type || '无',
        '描述': task.description || '',
        '重复规则': task.recurrence_rule || '无',
        '创建时间': task.created_at ? new Date(task.created_at).toLocaleString('zh-CN') : ''
      }));
      
      // 创建工作簿
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // 设置列宽
      const colWidths = [
        { wch: 6 },  // 序号
        { wch: 30 }, // 任务标题
        { wch: 20 }, // 开始时间
        { wch: 20 }, // 结束时间
        { wch: 10 }, // 优先级
        { wch: 10 }, // 重要程度
        { wch: 12 }, // 提醒类型
        { wch: 40 }, // 描述
        { wch: 15 }, // 重复规则
        { wch: 20 }  // 创建时间
      ];
      ws['!cols'] = colWidths;
      
      // 添加工作表
      XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
      
      // 保存文件
      const fileName = `smarttime-tasks-${dateRange.start}-to-${dateRange.end}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      showSuccess('Excel导出成功', `已导出 ${filteredTasks.length} 个任务到 ${fileName}`);
      onClose();
      
    } catch (error) {
      console.error('Excel导出失败:', error);
      showError('Excel导出失败', '请检查浏览器设置并重试');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    if (exportFormat === 'pdf') {
      exportToPDF();
    } else {
      exportToExcel();
    }
  };

  const filteredTasksCount = getFilteredTasks().length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3">
            <Download className="text-blue-500" size={20} />
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">导出任务数据</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* 导出格式选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              导出格式
            </label>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                onClick={() => setExportFormat('pdf')}
                className={`flex items-center gap-1 sm:gap-2 p-2 sm:p-3 border rounded-lg transition-colors ${
                  exportFormat === 'pdf'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <FileText size={16} className="sm:w-5 sm:h-5" />
                <span className="font-medium text-sm sm:text-base">PDF</span>
              </button>
              <button
                onClick={() => setExportFormat('excel')}
                className={`flex items-center gap-1 sm:gap-2 p-2 sm:p-3 border rounded-lg transition-colors ${
                  exportFormat === 'excel'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Table size={16} className="sm:w-5 sm:h-5" />
                <span className="font-medium text-sm sm:text-base">Excel</span>
              </button>
            </div>
          </div>

          {/* 日期范围选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              导出日期范围
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">开始日期</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">结束日期</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* 预览信息 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar size={16} />
              <span className="text-sm">
                将导出 <strong>{filteredTasksCount}</strong> 个任务
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              时间范围：{dateRange.start} 至 {dateRange.end}
            </p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 p-4 sm:p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm sm:text-base"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || filteredTasksCount === 0}
            className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {isExporting ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                导出中...
              </>
            ) : (
              <>
                <Download size={16} />
                导出 {exportFormat.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataExport;