/**
 * 性能监控面板组件
 * 显示实时性能数据和统计信息
 */

import React, { useState, useEffect } from 'react';
import { performanceMonitor, requestController } from '../utils/performanceMonitor';
import { Activity, Clock, AlertTriangle, TrendingUp, Server, Zap } from 'lucide-react';

// 简化的UI组件
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-lg border bg-white shadow-sm ${className}`}>{children}</div>
);

const CardHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>
);

const CardTitle = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>{children}</h3>
);

const CardContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-6 pt-0 ${className}`}>{children}</div>
);

const Button = ({ children, onClick, variant = 'default', size = 'default', className = '' }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm';
  className?: string;
}) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';
  const variantClasses = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
    ghost: 'text-gray-700 hover:bg-gray-100'
  };
  const sizeClasses = {
    default: 'h-10 px-4 py-2',
    sm: 'h-8 px-3 py-1'
  };
  
  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
};

const Badge = ({ children, variant = 'default', className = '' }: {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}) => {
  const variantClasses = {
    default: 'bg-blue-600 text-white',
    secondary: 'bg-gray-100 text-gray-800',
    destructive: 'bg-red-600 text-white',
    outline: 'border border-gray-300 text-gray-700'
  };
  
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};

const Progress = ({ value, className = '' }: { value: number; className?: string }) => (
  <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
    <div
      className="bg-blue-600 h-2 rounded-full transition-all"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

// 简化的Tabs组件
const Tabs = ({ defaultValue, children, className = '' }: {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  
  return (
    <div className={className}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { activeTab, setActiveTab } as any);
        }
        return child;
      })}
    </div>
  );
};

const TabsList = ({ children, className = '', activeTab, setActiveTab }: {
  children: React.ReactNode;
  className?: string;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}) => (
  <div className={`inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 ${className}`}>
    {React.Children.map(children, child => {
      if (React.isValidElement(child)) {
        return React.cloneElement(child, { activeTab, setActiveTab } as any);
      }
      return child;
    })}
  </div>
);

const TabsTrigger = ({ value, children, activeTab, setActiveTab }: {
  value: string;
  children: React.ReactNode;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}) => (
  <button
    onClick={() => setActiveTab?.(value)}
    className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${
      activeTab === value
        ? 'bg-white text-gray-900 shadow-sm'
        : 'text-gray-600 hover:text-gray-900'
    }`}
  >
    {children}
  </button>
);

const TabsContent = ({ value, children, className = '', activeTab }: {
  value: string;
  children: React.ReactNode;
  className?: string;
  activeTab?: string;
}) => {
  if (activeTab !== value) return null;
  return <div className={`mt-2 ${className}`}>{children}</div>;
};

interface PerformanceData {
  metrics: any[];
  errors: any[];
  report: any;
  concurrencyStatus: any;
}

export const PerformanceMonitor: React.FC = () => {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refreshData = () => {
    const exportedData = performanceMonitor.exportData();
    const concurrencyStatus = requestController.getStatus();
    
    setData({
      ...exportedData,
      concurrencyStatus
    });
  };

  useEffect(() => {
    if (isVisible) {
      refreshData();
      
      if (autoRefresh) {
        const interval = setInterval(refreshData, 2000);
        return () => clearInterval(interval);
      }
    }
  }, [isVisible, autoRefresh]);

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getCategoryColor = (category: string): string => {
    const colors = {
      api: 'bg-blue-500',
      ai: 'bg-purple-500',
      ui: 'bg-green-500',
      database: 'bg-orange-500',
      general: 'bg-gray-500'
    };
    return colors[category as keyof typeof colors] || colors.general;
  };

  const getPerformanceLevel = (avgTime: number): { level: string; color: string } => {
    if (avgTime < 500) return { level: '优秀', color: 'text-green-600' };
    if (avgTime < 1000) return { level: '良好', color: 'text-yellow-600' };
    if (avgTime < 2000) return { level: '一般', color: 'text-orange-600' };
    return { level: '需优化', color: 'text-red-600' };
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          className="bg-white shadow-lg"
        >
          <Activity className="w-4 h-4 mr-2" />
          性能监控
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-4 z-50 bg-white rounded-lg shadow-2xl border overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">性能监控面板</h2>
          {data && (
            <Badge variant="outline" className="ml-2">
              {data.report.totalMetrics} 条记录
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            {autoRefresh ? '自动刷新' : '手动刷新'}
          </Button>
          <Button onClick={refreshData} variant="outline" size="sm">
            刷新
          </Button>
          <Button
            onClick={() => {
              performanceMonitor.clearMetrics();
              refreshData();
            }}
            variant="outline"
            size="sm"
          >
            清除数据
          </Button>
          <Button
            onClick={() => setIsVisible(false)}
            variant="ghost"
            size="sm"
          >
            ✕
          </Button>
        </div>
      </div>

      <div className="p-4 h-[calc(100vh-8rem)] overflow-auto">
        {!data ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">正在加载性能数据...</p>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="h-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="metrics">详细指标</TabsTrigger>
              <TabsTrigger value="concurrency">并发控制</TabsTrigger>
              <TabsTrigger value="errors">错误日志</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">平均响应时间</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatTime(data.report.averageResponseTime)}
                    </div>
                    <p className={`text-xs ${getPerformanceLevel(data.report.averageResponseTime).color}`}>
                      {getPerformanceLevel(data.report.averageResponseTime).level}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">错误率</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {data.report.errorRate.toFixed(1)}%
                    </div>
                    <Progress value={data.report.errorRate} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">当前并发</CardTitle>
                    <Server className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {data.concurrencyStatus.currentRequests}/{data.concurrencyStatus.maxConcurrentRequests}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      队列: {data.concurrencyStatus.queuedRequests}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">总请求数</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {data.report.totalMetrics}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      最近5分钟
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">分类统计</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(data.report.categoryStats).map(([category, stats]: [string, any]) => (
                        <div key={category} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${getCategoryColor(category)}`} />
                            <span className="capitalize">{category}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {formatTime(stats.averageTime)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {stats.count} 次请求
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">最慢操作</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.report.slowestOperations.slice(0, 5).map((metric: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <div className="text-sm font-medium">{metric.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(metric.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                          <Badge variant={metric.value > 2000 ? "destructive" : "secondary"}>
                            {formatTime(metric.value)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>最近指标</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-auto">
                    {data.metrics.slice(-20).reverse().map((metric: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${getCategoryColor(metric.category)}`} />
                          <div>
                            <div className="text-sm font-medium">{metric.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(metric.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={metric.metadata?.error ? "destructive" : "secondary"}>
                            {formatTime(metric.value)}
                          </Badge>
                          {metric.metadata?.error && (
                            <div className="text-xs text-red-600 mt-1">错误</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="concurrency" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>并发控制状态</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded">
                        <div className="text-2xl font-bold text-blue-600">
                          {data.concurrencyStatus.currentRequests}
                        </div>
                        <div className="text-sm text-blue-600">当前执行</div>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 rounded">
                        <div className="text-2xl font-bold text-yellow-600">
                          {data.concurrencyStatus.queuedRequests}
                        </div>
                        <div className="text-sm text-yellow-600">队列等待</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded">
                        <div className="text-2xl font-bold text-green-600">
                          {data.concurrencyStatus.maxConcurrentRequests}
                        </div>
                        <div className="text-sm text-green-600">最大并发</div>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">并发使用率</span>
                        <span className="text-sm text-muted-foreground">
                          {Math.round((data.concurrencyStatus.currentRequests / data.concurrencyStatus.maxConcurrentRequests) * 100)}%
                        </span>
                      </div>
                      <Progress 
                        value={(data.concurrencyStatus.currentRequests / data.concurrencyStatus.maxConcurrentRequests) * 100} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="errors" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>错误日志</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.errors.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Zap className="w-12 h-12 mx-auto mb-4" />
                      <p>暂无错误记录</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-auto">
                      {data.errors.slice(-20).reverse().map((error: any, index: number) => (
                        <div key={index} className="p-3 bg-red-50 border border-red-200 rounded">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-red-800">
                                {error.error}
                              </div>
                              <div className="text-xs text-red-600 mt-1">
                                分类: {error.category} | 时间: {new Date(error.timestamp).toLocaleString()}
                              </div>
                            </div>
                            <Badge variant="destructive" className="ml-2">
                              错误
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default PerformanceMonitor;