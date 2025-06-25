# Maestro 测试策略

## 概述

作为一个管理多个 AI 代理的命令行工具，Maestro 需要全面的测试覆盖来确保可靠性。测试策略应涵盖单元测试、集成测试和端到端测试。

## 测试层级

### 1. 单元测试 (Unit Tests)

针对独立的类和函数进行测试，mock 外部依赖。

**需要测试的核心模块：**

- **Manager 类**
  - `StateManager`: 状态持久化、端口分配、状态验证
  - `ConfigManager`: 配置加载、验证、默认值处理
  - `TmuxManager`: tmux 命令构建、会话管理
  - `WorktreeManager`: Git 命令构建、分支管理
  - `AgentManager`: 代理生命周期协调

- **错误处理**
  - 自定义错误类的行为
  - 错误传播和转换

- **工具函数**
  - 端口验证
  - 命令模板替换
  - 路径处理

### 2. 集成测试 (Integration Tests)

测试多个组件之间的交互，使用部分真实依赖。

**关键集成场景：**

- 代理创建流程：Git worktree + tmux + 状态更新
- 代理终止流程：清理 worktree + tmux + 释放端口
- 检查点流程：Git 提交 + rebase
- 自动确认流程：tmux 窗格监控 + 响应发送

### 3. 端到端测试 (E2E Tests)

模拟真实用户场景，测试完整的命令执行流程。

**用户场景：**

1. **基础工作流**
   ```bash
   uzi prompt -n feature-x
   uzi ls
   uzi checkpoint feature-x
   uzi kill feature-x
   ```

2. **并行代理管理**
   ```bash
   uzi prompt -a claude:2,codex:1
   uzi broadcast "implement login feature"
   uzi run "npm test"
   uzi checkpoint --all
   ```

3. **错误恢复**
   - 状态文件损坏
   - tmux 会话意外终止
   - Git worktree 冲突

## 测试技术方案

### Mock 策略

```typescript
// 外部命令 mock
jest.mock('execa', () => ({
  execa: jest.fn(),
  execaSync: jest.fn()
}));

// 文件系统 mock
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn(),
  readJson: jest.fn(),
  writeJson: jest.fn(),
  pathExists: jest.fn()
}));

// tmux 操作 mock
class MockTmuxManager {
  async createSession() { /* mock implementation */ }
  async hasSession() { /* mock implementation */ }
  async sendKeys() { /* mock implementation */ }
}
```

### 测试数据构建

```typescript
// 测试工厂
class TestDataFactory {
  static createAgentSession(overrides?: Partial<AgentSession>) {
    return {
      id: 'test-id',
      name: 'test-agent',
      model: 'claude',
      port: 3000,
      worktreePath: '/test/path',
      createdAt: new Date().toISOString(),
      ...overrides
    };
  }

  static createState(sessions: AgentSession[] = []) {
    return {
      sessions,
      allocatedPorts: {},
      worktreePaths: {}
    };
  }
}
```

### 异步测试模式

```typescript
// 并发操作测试
it('should handle concurrent agent creation', async () => {
  const promises = Array(5).fill(null).map((_, i) => 
    agentManager.createAgent({
      name: `agent-${i}`,
      model: 'claude'
    })
  );
  
  const results = await Promise.all(promises);
  expect(results).toHaveLength(5);
  expect(new Set(results.map(r => r.port))).toHaveLength(5); // 端口不重复
});
```

## 测试工具集

### 必需的测试依赖

```json
{
  "devDependencies": {
    "@testing-library/react": "^15.0.0", // 用于测试 Ink 组件
    "mock-fs": "^5.0.0", // 模拟文件系统
    "nock": "^13.0.0", // HTTP 请求 mock
    "sinon": "^17.0.0", // spy 和 stub
    "supertest": "^6.0.0" // CLI 测试
  }
}
```

### 测试辅助函数

```typescript
// CLI 命令测试辅助
export async function runCommand(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  // 运行 CLI 并捕获输出
}

// tmux 模拟器
export class TmuxSimulator {
  private sessions: Map<string, MockSession> = new Map();
  
  async createSession(name: string) {
    this.sessions.set(name, new MockSession(name));
  }
  
  async capturePane(session: string, window: number): string {
    return this.sessions.get(session)?.getOutput(window) || '';
  }
}
```

## 测试覆盖目标

- **代码覆盖率**: 最低 80%，核心模块 90%+
- **分支覆盖**: 所有 if/else 路径
- **错误路径**: 100% 错误处理测试
- **并发场景**: 关键并发操作的测试

## 持续集成配置

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
        node: [16, 18, 20]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
```

## 测试执行策略

1. **开发时**: `npm run test:watch` 持续运行相关测试
2. **提交前**: pre-commit hook 运行快速测试
3. **PR 时**: 完整测试套件 + 覆盖率检查
4. **发布前**: 全平台 E2E 测试

## 特殊测试场景

### tmux 交互测试

```typescript
describe('Auto confirmation', () => {
  it('should respond to Y/n prompts', async () => {
    const tmuxSim = new TmuxSimulator();
    await tmuxSim.createSession('test');
    await tmuxSim.simulateOutput('Continue? [Y/n]:');
    
    await autoCommand.checkAndRespond(tmuxSim);
    
    expect(tmuxSim.getLastInput()).toBe('Y');
  });
});
```

### Git worktree 测试

```typescript
describe('Worktree management', () => {
  let testRepo: TestGitRepo;
  
  beforeEach(async () => {
    testRepo = await TestGitRepo.create();
  });
  
  it('should create isolated worktree', async () => {
    const worktree = await worktreeManager.create('feature-x');
    
    expect(await testRepo.hasWorktree('uzi/feature-x')).toBe(true);
    expect(await testRepo.getCurrentBranch(worktree.path)).toBe('uzi/feature-x');
  });
});
```

### 状态恢复测试

```typescript
describe('State recovery', () => {
  it('should recover from corrupted state', async () => {
    await fs.writeJson(STATE_PATH, '{ invalid json');
    
    const state = await stateManager.loadState();
    
    expect(state).toEqual(DEFAULT_STATE);
    expect(logger.warn).toHaveBeenCalledWith('State file corrupted');
  });
});
```