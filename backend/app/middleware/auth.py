from fastapi import HTTPException, status, Header, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import Optional, Dict, Any
from ..utils.config import get_settings
import time
import hashlib

# 获取配置
settings = get_settings()

security = HTTPBearer()

# Token缓存
token_cache = {}
CACHE_TTL = 300  # 5分钟缓存
MAX_CACHE_SIZE = 1000  # 最大缓存条目数

def clean_expired_cache():
    """清理过期的缓存条目"""
    current_time = time.time()
    expired_keys = []
    for key, (data, cached_time) in token_cache.items():
        if current_time - cached_time >= CACHE_TTL:
            expired_keys.append(key)
    
    for key in expired_keys:
        del token_cache[key]
    
    # 如果缓存仍然太大，删除最旧的条目
    if len(token_cache) > MAX_CACHE_SIZE:
        sorted_items = sorted(token_cache.items(), key=lambda x: x[1][1])
        items_to_remove = len(token_cache) - MAX_CACHE_SIZE
        for i in range(items_to_remove):
            del token_cache[sorted_items[i][0]]

class AuthMiddleware:
    """JWT认证中间件"""
    
    async def verify_supabase_token(self, token: str) -> Optional[Dict[str, Any]]:
        """通过Supabase Auth API验证token（带缓存）"""
        try:
            # 生成token的缓存键
            token_hash = hashlib.md5(token.encode()).hexdigest()
            current_time = time.time()
            
            # 定期清理过期缓存
            if len(token_cache) > 100:  # 当缓存条目较多时才清理
                clean_expired_cache()
            
            # 检查缓存
            if token_hash in token_cache:
                cached_data, cached_time = token_cache[token_hash]
                if current_time - cached_time < CACHE_TTL:
                    print(f"[AUTH DEBUG] 使用缓存的token验证结果: {token[:20]}...")
                    return cached_data
                else:
                    # 缓存过期，删除
                    del token_cache[token_hash]
            
            print(f"[AUTH DEBUG] 通过Supabase API验证token: {token[:20]}...")
            
            # 使用Supabase Auth API验证token
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{settings.supabase_url}/auth/v1/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "apikey": settings.supabase_anon_key,
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    user_data = response.json()
                    result = {
                        "sub": user_data.get("id"), 
                        "email": user_data.get("email"),
                        "user_metadata": user_data.get("user_metadata", {})
                    }
                    # 缓存成功的验证结果
                    token_cache[token_hash] = (result, current_time)
                    print(f"[AUTH DEBUG] Supabase API验证成功，用户: {user_data.get('id')}，已缓存")
                    return result
                elif response.status_code == 401:
                    print(f"[AUTH DEBUG] Token已过期或无效，状态码: {response.status_code}")
                    # 缓存失败结果（短时间）
                    token_cache[token_hash] = (None, current_time)
                    return None
                else:
                    print(f"[AUTH DEBUG] Supabase API验证失败，状态码: {response.status_code}, 响应: {response.text}")
                    return None
                    
        except httpx.TimeoutException:
            print(f"[AUTH DEBUG] Supabase API请求超时")
            return None
        except Exception as e:
            print(f"[AUTH DEBUG] Supabase API验证异常: {type(e).__name__}: {str(e)}")
            import traceback
            print(f"[AUTH DEBUG] 异常堆栈: {traceback.format_exc()}")
            return None
    
    @staticmethod
    def verify_token(token: str) -> Optional[str]:
        """验证JWT token并返回用户ID"""
        # 这个方法现在是同步的，我们需要在get_current_user_id中调用异步方法
        return None
    
    @staticmethod
    def get_current_user_id(credentials: HTTPAuthorizationCredentials) -> str:
        """从Authorization header中获取当前用户ID"""
        token = credentials.credentials
        user_id = AuthMiddleware.verify_token(token)
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user_id
    
    @staticmethod
    def get_user_id_from_request(request: Request) -> Optional[str]:
        """从请求中提取用户ID（可选认证）"""
        authorization = request.headers.get("Authorization")
        if not authorization:
            return None
        
        try:
            scheme, token = authorization.split(" ")
            if scheme.lower() != "bearer":
                return None
            return AuthMiddleware.verify_token(token)
        except ValueError:
            return None

# 依赖注入函数
async def get_current_user_id(authorization: str = Header(None)) -> str:
    """从Authorization header中提取并验证JWT token，返回用户ID"""
    print(f"[AUTH DEBUG] 收到Authorization header: {authorization}")
    
    if not authorization:
        print(f"[AUTH DEBUG] 缺少Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header"
        )
    
    try:
        # 提取Bearer token
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            print(f"[AUTH DEBUG] 无效的认证方案: {scheme}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication scheme"
            )
        
        print(f"[AUTH DEBUG] 提取到token: {token[:20]}...")
        
        # 使用Supabase API验证token
        auth_middleware = AuthMiddleware()
        user_data = await auth_middleware.verify_supabase_token(token)
        if not user_data or not user_data.get("sub"):
            print(f"[AUTH DEBUG] Token验证失败")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        user_id = user_data.get("sub")
        print(f"[AUTH DEBUG] 认证成功，用户ID: {user_id}")
        return user_id
        
    except ValueError:
        print(f"[AUTH DEBUG] Authorization header格式错误")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH DEBUG] 认证过程中发生异常: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

def get_optional_user_id(request: Request) -> Optional[str]:
    """获取可选用户ID的依赖注入函数"""
    return AuthMiddleware.get_user_id_from_request(request)