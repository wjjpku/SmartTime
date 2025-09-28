import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';

interface NetworkStatusProps {
  onNetworkChange?: (isOnline: boolean) => void;
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({ onNetworkChange }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      onNetworkChange?.(true);
      
      // 3秒后隐藏状态提示
      setTimeout(() => setShowStatus(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
      onNetworkChange?.(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 初始状态检查
    if (!navigator.onLine) {
      setShowStatus(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onNetworkChange]);

  if (!showStatus && isOnline) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ${
      isOnline 
        ? 'bg-green-100 text-green-800 border border-green-200' 
        : 'bg-red-100 text-red-800 border border-red-200'
    }`}>
      {isOnline ? (
        <>
          <Wifi size={16} />
          <span className="text-sm font-medium">网络已连接</span>
        </>
      ) : (
        <>
          <WifiOff size={16} />
          <span className="text-sm font-medium">网络连接断开</span>
        </>
      )}
    </div>
  );
};

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsConnecting(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsConnecting(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkConnection = async (): Promise<boolean> => {
    if (!navigator.onLine) {
      return false;
    }

    setIsConnecting(true);
    try {
      // 使用一个更可靠的网络检测方法
      // 尝试访问一个公共的、稳定的资源
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        mode: 'no-cors', // 避免CORS问题
        signal: AbortSignal.timeout(5000) // 5秒超时
      });
      
      // 对于no-cors模式，只要请求没有抛出异常就说明网络是通的
      setIsOnline(true);
      return true;
    } catch (error: any) {
      console.log('网络连接检测失败:', error.message);
      
      // 区分不同类型的错误
      if (error.name === 'AbortError') {
        console.log('网络检测超时');
      } else if (error.message.includes('Failed to fetch')) {
        console.log('网络连接失败');
      }
      
      setIsOnline(false);
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  return {
    isOnline,
    isConnecting,
    checkConnection
  };
};

export default NetworkStatus;