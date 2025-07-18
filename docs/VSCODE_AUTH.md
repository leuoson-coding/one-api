# VSCode 插件认证 API 文档

本文档描述了为 VSCode 插件提供的标准 OAuth 2.0 认证 API。

## API 端点

### 1. 获取授权 URL

**端点**: `GET /api/vscode/authorize`

**参数**:
- `redirect_uri` (必需): VSCode 插件的回调 URI

**响应**:
```json
{
  "authorization_url": "http://localhost:3001/vscode/auth?redirect_uri=...&state=...",
  "state": "随机生成的状态码"
}
```

### 2. 处理 OAuth 回调

**端点**: `POST /api/vscode/callback`

**请求体**:
```json
{
  "code": "GitHub OAuth 授权码",
  "state": "之前返回的状态码",
  "redirect_uri": "回调 URI"
}
```

**成功响应**:
```json
{
  "access_token": "JWT 访问令牌",
  "token_type": "Bearer",
  "scope": "user",
  "account": {
    "id": 用户ID,
    "label": "用户名",
    "email": "用户邮箱"
  }
}
```

**错误响应**:
```json
{
  "error": "错误类型",
  "error_description": "错误描述"
}
```

### 3. 获取用户信息

**端点**: `GET /api/vscode/user`

**请求头**:
```
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "id": 用户ID,
  "username": "用户名",
  "email": "用户邮箱",
  "display_name": "显示名称",
  "role": 用户角色
}
```

## VSCode 插件集成

### 认证提供者实现

```typescript
export class VSCodeAuthProvider implements vscode.AuthenticationProvider {
    async getSessions(): Promise<vscode.AuthenticationSession[]> {
        // 从存储中获取已保存的会话
    }

    async createSession(): Promise<vscode.AuthenticationSession> {
        // 1. 调用 /api/vscode/authorize 获取授权 URL
        // 2. 打开浏览器进行授权
        // 3. 获取授权码
        // 4. 调用 /api/vscode/callback 交换访问令牌
        // 5. 返回会话对象
    }

    async removeSession(sessionId: string): Promise<void> {
        // 删除指定会话
    }
}
```

### 插件注册

```typescript
export function activate(context: vscode.ExtensionContext) {
    const authProvider = new VSCodeAuthProvider(context, serverUrl);
    context.subscriptions.push(
        vscode.authentication.registerAuthenticationProvider(
            'your-service',
            'Your Service',
            authProvider
        )
    );
}
```

## 前端页面

### VSCode 认证流程页面

1. **登录选择页面** (`/vscode/auth`):
   - 提供多种登录方式（GitHub OAuth、邮箱密码）
   - 接收 VSCode 传入的回调参数

2. **GitHub 回调处理页面** (`/vscode/github-callback`):
   - 处理 GitHub OAuth 回调
   - 生成授权码并跳转到结果页面

3. **授权码显示页面** (`/vscode/callback`):
   - 显示生成的授权码
   - 提供复制功能和使用说明

### 测试页面

访问 `/vscode/test` 可以测试完整的认证流程。

## 安全特性

1. **状态验证**: 使用随机生成的 state 参数防止 CSRF 攻击
2. **JWT 令牌**: 使用 JWT 生成访问令牌，包含过期时间和作用域
3. **作用域限制**: 令牌包含 `vscode` 作用域标识
4. **会话管理**: 复用现有的会话管理机制

## 错误处理

API 遵循 OAuth 2.0 标准错误格式：

- `invalid_request`: 请求参数错误
- `invalid_grant`: 授权码无效
- `invalid_state`: 状态参数无效
- `access_denied`: 用户被封禁
- `server_error`: 服务器内部错误
- `unauthorized`: 未提供或无效的访问令牌
- `invalid_token`: 访问令牌无效

## 配置要求

确保以下环境变量已正确配置：

- `GITHUB_CLIENT_ID`: GitHub OAuth 应用的客户端 ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth 应用的客户端密钥
- `SESSION_SECRET`: 用于 JWT 签名的密钥
