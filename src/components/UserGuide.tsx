import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Lightbulb, Keyboard, Calendar, Zap } from 'lucide-react';

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideStep {
  title: string;
  content: string;
  icon: React.ReactNode;
  tips?: string[];
}

const guideSteps: GuideStep[] = [
  {
    title: '欢迎使用 SmartTime',
    content: 'SmartTime 是一个智能时间管理系统，支持自然语言输入、AI 解析和智能提醒功能。让我们快速了解主要功能。',
    icon: <Lightbulb className="w-8 h-8 text-blue-500" />,
    tips: [
      '支持中文自然语言输入',
      '智能识别时间、地点、重要性',
      '自动设置提醒和重复规则'
    ]
  },
  {
    title: '智能任务创建',
    content: '在输入框中用自然语言描述您的任务，AI 会自动解析并创建结构化的任务。',
    icon: <Zap className="w-8 h-8 text-green-500" />,
    tips: [
      '示例："明天下午3点在会议室开会"',
      '示例："每周一上午9点团队例会"',
      '示例："重要：下周五提交项目报告"',
      '支持时间、地点、重要性、重复等信息'
    ]
  },
  {
    title: '日历视图操作',
    content: '使用多种视图查看和管理您的任务，支持日、周、月视图切换。',
    icon: <Calendar className="w-8 h-8 text-purple-500" />,
    tips: [
      '点击任务可以编辑详情',
      '拖拽任务可以调整时间',
      '右上角按钮可以筛选和导出',
      '支持批量删除功能'
    ]
  },
  {
    title: '快捷键操作',
    content: '使用键盘快捷键快速切换视图和导航日历。',
    icon: <Keyboard className="w-8 h-8 text-orange-500" />,
    tips: [
      'D - 切换到日视图',
      'W - 切换到周视图',
      'M - 切换到月视图',
      'T - 回到今天'
    ]
  }
];

const UserGuide: React.FC<UserGuideProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowGuide(true);
      setCurrentStep(0);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep < guideSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setShowGuide(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleSkip = () => {
    // 标记用户已查看引导
    localStorage.setItem('smarttime_guide_viewed', 'true');
    handleClose();
  };

  if (!isOpen) return null;

  const currentGuideStep = guideSteps[currentStep];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl shadow-2xl max-w-2xl w-full transform transition-all duration-300 ${
        showGuide ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {currentGuideStep.icon}
            <h2 className="text-xl font-semibold text-gray-900">
              {currentGuideStep.title}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6">
          {/* 步骤指示器 */}
          <div className="flex justify-center mb-6">
            <div className="flex gap-2">
              {guideSteps.map((_, index) => (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentStep
                      ? 'bg-blue-500'
                      : index < currentStep
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* 主要内容 */}
          <div className="text-center mb-6">
            <p className="text-gray-700 text-lg leading-relaxed mb-4">
              {currentGuideStep.content}
            </p>
            
            {/* 提示列表 */}
            {currentGuideStep.tips && (
              <div className="bg-blue-50 rounded-lg p-4 text-left">
                <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  实用提示
                </h4>
                <ul className="space-y-2">
                  {currentGuideStep.tips.map((tip, index) => (
                    <li key={index} className="text-blue-800 text-sm flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {currentStep + 1} / {guideSteps.length}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {currentStep === 0 && (
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                跳过引导
              </button>
            )}
            
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                上一步
              </button>
            )}
            
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {currentStep === guideSteps.length - 1 ? '开始使用' : '下一步'}
              {currentStep < guideSteps.length - 1 && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserGuide;