# Claude API Backend (TypeScript + Bun)

一个高性能的 Claude CLI 会话管理后端服务，使用 Bun 运行时和 TypeScript 构建。

## 特性

- ⚡ **高性能**: 使用 Bun 运行时和 Elysia 框架
- 🔄 **实时流式输出**: 通过 Server-Sent Events (SSE) 推送
- 📝 **TypeScript**: 完整的类型安全
- 🚀 **热重载**: 开发模式下自动重载
- 🔧 **灵活配置**: 支持命令行参数和配置文件

## 系统要求

- Bun v1.0+
- Claude CLI（用于实际功能测试）

## 安装

```bash
bun install
```

## 运行

### 开发模式（带热重载）
```bash
bun run dev
```

### 生产模式
```bash
bun run start
```

### 自定义端口
```bash
bun run start -- --port 3000
```

### 使用配置文件
```bash
bun run start -- --config config.json
```

## API 端点

- `GET /health` - 健康检查
- `GET /api/v1/health` - API 健康检查
- `POST /api/v1/sessions/execute` - 创建新的 Claude 会话
- `GET /api/v1/sessions/:id` - 获取会话信息
- `GET /api/v1/sessions` - 列出所有会话
- `POST /api/v1/sessions/:id/cancel` - 取消运行中的会话
- `GET /api/v1/sessions/:id/stream` - 会话输出的 SSE 流

## 使用示例

### 创建会话
```bash
curl -X POST http://localhost:8080/api/v1/sessions/execute \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/path/to/project",
    "prompt": "Help me create a new feature",
    "model": "sonnet"
  }'
```

### 接收流式输出
```javascript
const eventSource = new EventSource('http://localhost:8080/api/v1/sessions/{sessionId}/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'connected':
      console.log('Connected to stream');
      break;
    case 'output':
      console.log(data.data.content);
      break;
    case 'error':
      console.error(data.data);
      break;
    case 'complete':
      eventSource.close();
      break;
  }
};
```

## 测试

### 模拟测试（不需要 Claude CLI）
```bash
bun run test_mock.ts
```

### 完整测试（需要 Claude CLI）
```bash
bun run test_client.ts
```

## 构建

```bash
bun run build
```

生成优化后的构建文件到 `dist` 目录。

## 类型检查

```bash
bun run typecheck
```

## 项目结构

```
src/
├── index.ts          # 主入口文件
├── config/           # 配置管理
│   └── index.ts      # 配置加载和验证
├── models/           # TypeScript 类型定义
│   └── index.ts      # 数据模型和枚举
├── claude/           # Claude 进程管理
│   └── manager.ts    # 会话和进程管理器
└── api/              # API 路由
    └── routes.ts     # HTTP 端点定义
```

## 配置

创建 `config.json` 文件：

```json
{
  "claude": {
    "binaryPath": "claude",
    "defaultModel": "sonnet",
    "maxConcurrentSessions": 5,
    "defaultArgs": [
      "--output-format", "stream-json",
      "--verbose",
      "--dangerously-skip-permissions"
    ]
  }
}
```

## 与 Go 版本的对比

| 特性 | Go 版本 | TypeScript 版本 |
|------|---------|----------------|
| 框架 | Gin | Elysia |
| 运行时 | Go | Bun |
| 进程管理 | exec.Command | Bun.spawn |
| 流处理 | io.Reader | Web Streams API |
| 验证 | 手动验证 | Zod schemas |
| 构建时间 | ~2s | <100ms |
| 热重载 | ❌ | ✅ |

## 性能

TypeScript + Bun 版本提供了与 Go 版本相当的性能，同时具有以下优势：
- 更快的启动时间
- 原生 TypeScript 支持
- 现代 async/await 模式
- 内置的开发热重载

## 许可证

MIT