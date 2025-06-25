# Maestro 用户指南

## 目录
1. [简介](#简介)
2. [安装](#安装)
3. [前置要求](#前置要求)
4. [配置](#配置)
5. [核心概念](#核心概念)
6. [命令参考](#命令参考)
7. [工作流程](#工作流程)
8. [最佳实践](#最佳实践)
9. [故障排除](#故障排除)

## 简介

Maestro 是一个强大的命令行工具，用于并行管理多个 AI 编程助手。它使开发者能够同时利用多个 AI 助手，每个助手都在隔离的 Git 工作树中工作，拥有自己的开发环境。这种方法通过允许不同的代理在项目的不同方面工作而不产生冲突，从而最大化生产力。

### 主要优势
- **并行开发**：在不同任务上同时运行多个 AI 代理
- **隔离性**：每个代理在自己的 Git 工作树中工作，防止冲突
- **自动环境设置**：每个代理获得自己的开发服务器，自动分配端口
- **会话管理**：通过 tmux 轻松监控和控制所有活动代理
- **无缝集成**：使用简单命令将完成的工作合并回主分支

## 安装

### 从源代码安装

```bash
# 克隆仓库
git clone https://github.com/your-repo/maestro-ts.git
cd maestro-ts

# 安装依赖
npm install

# 构建项目
npm run build

# 全局链接（可选）
npm link
```

### 前置条件检查

在使用 Maestro 之前，请确保已安装以下软件：

```bash
# 检查 Node.js（需要 v16+）
node --version

# 检查 Git
git --version

# 检查 tmux
tmux -V
```

## 前置要求

### 必需软件

1. **Node.js**（v16 或更高版本）
   - 运行 TypeScript 实现所需
   - 从 [nodejs.org](https://nodejs.org/) 安装

2. **Git**
   - 版本控制和工作树管理必需
   - 通过包管理器或从 [git-scm.com](https://git-scm.com/) 安装

3. **tmux**
   - 用于会话管理的终端复用器
   - 安装方法：
     - macOS：`brew install tmux`
     - Ubuntu/Debian：`sudo apt-get install tmux`
     - 其他：查看您的包管理器

4. **AI CLI 工具**（至少一个）
   - 例如：`claude`、`aider`、`cursor` 或任何支持 CLI 的 AI 编程助手
   - 这些工具应该已安装并可从 PATH 访问

### 项目要求

- 您的项目必须是 Git 仓库
- 您的仓库中应该至少有一个提交
- 足够的磁盘空间用于多个工作树（每个都是项目的完整副本）

## 配置

### 创建 maestro.yaml

Maestro 使用 YAML 配置文件来自定义其行为。在项目根目录创建 `maestro.yaml` 文件：

```yaml
# 开发服务器命令
# 使用 $PORT 作为端口号的占位符
devCommand: npm install && npm run dev -- --port $PORT

# 开发服务器端口范围
portRange:
  start: 3000
  end: 4000

# 可选：自动确认提示
autoConfirm: false

# 可选：默认 AI 模型
defaultModel: claude
```

### 配置示例

#### Next.js 项目
```yaml
devCommand: npm install && npm run dev -- --port $PORT
portRange:
  start: 3000
  end: 3010
```

#### Vite 项目
```yaml
devCommand: npm install && npm run dev -- --port $PORT --host
portRange:
  start: 5173
  end: 5180
```

#### Python/Django 项目
```yaml
devCommand: pip install -r requirements.txt && python manage.py runserver 0.0.0.0:$PORT
portRange:
  start: 8000
  end: 8010
```

#### 多个设置命令
```yaml
# 需要数据库设置的项目
devCommand: |
  npm install &&
  npm run db:migrate &&
  npm run dev -- --port $PORT
portRange:
  start: 3000
  end: 3010
```

### 全局选项

Maestro 支持可用于任何命令的全局选项：

- `-v, --verbose`：启用详细输出以进行调试
- `-c, --config <path>`：指定自定义配置文件位置

## 核心概念

### 代理（Agents）
代理是在自己的隔离环境中运行的 AI 编程助手实例（如 Claude、GPT-4 等）。每个代理：
- 有唯一的名称（例如 `claude-1`、`gpt4-2`）
- 在自己的 Git 工作树中工作
- 在专用的 tmux 会话中运行
- 在唯一端口上有自己的开发服务器

### Git 工作树
Git 工作树允许同一仓库有多个工作目录。Maestro 利用这一点来：
- 隔离每个代理的更改
- 防止并行开发期间的合并冲突
- 轻松集成完成的工作

### Tmux 会话
每个代理在 tmux 会话中运行，包含两个窗口：
1. **agent**：AI 工具运行和交互的地方
2. **dev**：开发服务器运行的地方

### 状态管理
Maestro 维护一个全局状态文件，跟踪：
- 活动会话及其配置
- 端口分配
- 工作树位置
- 代理状态和元数据

## 命令参考

### `maestro prompt`
使用指定的 AI 模型和任务创建新的代理会话。

```bash
# 基本用法
maestro prompt -a "claude:2" -t "实现用户认证"

# 多种代理类型
maestro prompt -a "claude:2,gpt4:1" -t "构建 REST API"

# 使用自动确认
maestro prompt -a "claude:1" -t "修复所有 TypeScript 错误" --auto
```

**选项：**
- `-a, --agents <spec>`：代理规范（格式：`model:count`）
- `-t, --task <task>`：代理的任务描述
- `--auto`：启用自动确认模式

**代理规范格式：**
- `claude:2` - 创建 2 个 Claude 代理
- `gpt4:1,claude:2` - 创建 1 个 GPT-4 和 2 个 Claude 代理

### `maestro ls`
列出所有活动代理会话。

```bash
# 列出会话
maestro ls

# 监视模式（自动刷新）
maestro ls --watch
maestro ls -w

# JSON 输出
maestro ls --json
```

**输出列：**
- Name：代理标识符
- Model：使用的 AI 模型
- Status：当前状态（active/inactive/error）
- Port：开发服务器端口
- Tmux Session：tmux 会话名称

### `maestro kill`
终止代理会话并清理资源。

```bash
# 终止特定代理
maestro kill claude-1

# 终止所有代理
maestro kill --all
```

**清理操作：**
- 终止 tmux 会话
- 删除 Git 工作树
- 释放分配的端口
- 更新状态文件

### `maestro run`
在所有活动代理中并行执行命令。

```bash
# 在所有代理中运行命令
maestro run "npm test"

# 检查 git 状态
maestro run "git status"

# 安装新依赖
maestro run "npm install axios"
```

**特性：**
- 使用 Promise.all() 并行执行
- 捕获 stdout 和 stderr
- 按代理分组显示结果

### `maestro broadcast`
向所有活动代理会话发送消息。

```bash
# 发送指令
maestro broadcast "请为所有 API 端点添加错误处理"

# 发送提醒
maestro broadcast "记得遵循编码规范"
```

### `maestro checkpoint`
提交代理的更改并变基到您的分支。

```bash
# 检查点特定代理
maestro checkpoint claude-1

# 检查点所有代理
maestro checkpoint

# 检查点到特定分支
maestro checkpoint claude-1 -b develop
```

**选项：**
- `-b, --branch <branch>`：变基的目标分支（默认：main）

**过程：**
1. 提交代理工作树中的所有更改
2. 变基到目标分支
3. 准备集成更改

### `maestro auto`
作为后台进程运行，自动处理代理提示。

```bash
# 默认间隔（5 秒）
maestro auto

# 自定义间隔
maestro auto -i 10
```

**选项：**
- `-i, --interval <seconds>`：检查间隔（默认：5）

**自动处理：**
- 确认提示（Continue?、Proceed?、[Y/n]）
- 信任提示
- 空输入提示（按 Enter）

### `maestro reset`
完全重置 Maestro，删除所有数据和会话。

```bash
# 带确认提示
maestro reset

# 跳过确认
maestro reset --force
```

**警告**：此操作将：
- 终止所有活动会话
- 删除所有工作树
- 删除状态文件
- 删除 `.maestro` 目录

## 工作流程

### 基本开发工作流程

1. **初始化项目**
   ```bash
   # 确保您在 git 仓库中
   git init
   git add .
   git commit -m "Initial commit"
   
   # 创建 maestro.yaml
   echo "devCommand: npm run dev -- --port \$PORT
   portRange:
     start: 3000
     end: 4000" > maestro.yaml
   ```

2. **启动带任务的代理**
   ```bash
   maestro prompt -a "claude:2" -t "实现带邮箱验证的用户注册"
   ```

3. **在另一个终端运行自动模式**
   ```bash
   maestro auto
   ```

4. **监控进度**
   ```bash
   # 在另一个终端
   maestro ls --watch
   ```

5. **根据需要发送额外指令**
   ```bash
   maestro broadcast "使用 bcrypt 进行密码哈希"
   ```

6. **检查实现**
   ```bash
   # 运行测试
   maestro run "npm test"
   
   # 检查更改
   maestro run "git diff"
   ```

7. **集成完成的工作**
   ```bash
   # 首先查看更改
   cd .maestro/worktrees/claude-1
   git diff
   
   # 如果满意，创建检查点
   maestro checkpoint claude-1
   ```

### 并行功能开发

同时开发多个功能时：

```bash
# 为不同功能启动代理
maestro prompt -a "claude:1" -t "实现用户认证"
maestro prompt -a "gpt4:1" -t "创建管理仪表板"
maestro prompt -a "claude:1" -t "添加 API 速率限制"

# 监控所有代理
maestro ls --watch

# 定期运行测试
maestro run "npm test"

# 功能完成时创建检查点
maestro checkpoint claude-1  # 认证完成
maestro checkpoint gpt4-1    # 仪表板完成
maestro checkpoint claude-2  # 速率限制完成
```

### 调试工作流程

当代理遇到问题时：

```bash
# 检查代理输出
tmux attach -t maestro-claude-1

# 检查开发服务器日志
# 导航到 dev 窗口：Ctrl+b，然后 2

# 发送调试指令
maestro broadcast "检查控制台错误"

# 运行诊断命令
maestro run "npm run lint"
maestro run "npm run typecheck"
```

### 代码审查工作流程

集成代理更改之前：

```bash
# 列出所有代理
maestro ls

# 对每个代理，审查更改
cd .maestro/worktrees/claude-1
git diff
npm test

# 如果更改看起来不错
maestro checkpoint claude-1

# 如果更改需要修改
maestro broadcast "请修复 claude-1 中失败的测试"
```

## 最佳实践

### 1. 任务规范
- 在任务描述中具体而详细
- 将大任务分解为更小、更专注的部分
- 在任务中包含验收标准

**好的做法：**
```bash
maestro prompt -a "claude:1" -t "实现用户注册，包括：
- 邮箱/密码认证
- 邮箱验证
- 密码强度要求（最少 8 个字符，1 个大写字母，1 个数字）
- 速率限制（每小时最多 5 次尝试）
- 适当的错误消息
- 单元测试覆盖率 >80%"
```

**效果较差：**
```bash
maestro prompt -a "claude:1" -t "添加用户注册"
```

### 2. 代理分配
- 为独立功能使用多个代理
- 避免在相互依赖的任务上使用太多代理
- 考虑您的机器资源（CPU、内存）

```bash
# 好的做法：独立功能
maestro prompt -a "claude:1" -t "用户认证模块"
maestro prompt -a "gpt4:1" -t "邮件服务模块"

# 有问题的：依赖功能
maestro prompt -a "claude:3" -t "重构同一个认证模块"
```

### 3. 定期检查点
- 经常为工作功能创建检查点
- 不要等到一切都完美
- 使用描述性的提交消息

```bash
# 定期检查点
maestro checkpoint claude-1  # 认证实现后
maestro checkpoint claude-1  # 添加测试后
maestro checkpoint claude-1  # 添加文档后
```

### 4. 资源管理
- 运行多个代理时监控系统资源
- 终止空闲代理以释放资源
- 定期使用 `maestro ls` 跟踪活动会话

```bash
# 检查活动代理
maestro ls

# 终止空闲代理
maestro kill claude-2
```

### 5. 自动模式使用
- 使用 Claude 或类似工具时始终运行 `maestro auto`
- 在专用终端中运行以便于监控
- 检查自动模式输出中的任何问题

### 6. Git 卫生
- 启动代理前确保 git 状态干净
- 先提交或暂存您的更改
- 在检查点中使用有意义的分支名称

```bash
# 启动前保持干净状态
git status
git stash

# 启动代理
maestro prompt -a "claude:2" -t "新功能"
```

## 故障排除

### 常见问题和解决方案

#### 1. "配置范围内没有可用端口"
**问题**：配置范围内的所有端口都在使用中。

**解决方案**：
```bash
# 检查当前端口使用情况
maestro ls

# 终止未使用的代理
maestro kill --all

# 或在 maestro.yaml 中扩展端口范围
portRange:
  start: 3000
  end: 5000
```

#### 2. "创建工作树失败"
**问题**：Git 工作树创建失败。

**解决方案**：
```bash
# 修剪无效的工作树
git worktree prune

# 检查现有工作树
git worktree list

# 清理并重试
rm -rf .maestro
maestro reset --force
```

#### 3. "找不到 tmux 会话"
**问题**：tmux 会话不存在或被外部终止。

**解决方案**：
```bash
# 检查 tmux 会话
tmux ls

# 清理 Maestro 状态
maestro kill agent-name
```

#### 4. 代理不响应提示
**问题**：自动模式未运行或未检测到提示。

**解决方案**：
```bash
# 确保自动模式正在运行
maestro auto

# 手动附加以检查
tmux attach -t maestro-agent-name

# 发送手动响应
maestro broadcast "y"
```

#### 5. 开发服务器未启动
**问题**：开发服务器无法启动或端口错误。

**解决方案**：
- 检查 maestro.yaml 中的 `devCommand`
- 确保正确使用 `$PORT` 占位符
- 验证已安装依赖
- 检查端口冲突

```bash
# 调试开发服务器
tmux attach -t maestro-agent-name
# 切换到 dev 窗口：Ctrl+b，然后 2
```

### 调试模式

获取详细的调试信息：

```bash
# 使用详细标志运行命令
maestro -v prompt -a "claude:1" -t "调试任务"

# 检查状态文件
cat ~/.local/share/maestro/state.json

# 检查 Maestro 日志（如果有）
ls -la ~/.local/share/maestro/
```

### 获取帮助

1. **检查命令帮助**：
   ```bash
   maestro --help
   maestro prompt --help
   ```

2. **查看活动配置**：
   ```bash
   cat maestro.yaml
   ```

3. **检查状态**：
   ```bash
   maestro ls --json | jq .
   ```

### 全新开始

如果一切都失败了，重新开始：

```bash
# 完全重置
maestro reset --force

# 如果需要，手动删除 git 工作树
git worktree list
git worktree remove .maestro/worktrees/agent-name

# 如有必要，重新安装
npm install
npm run build
```

## 高级技巧

### 1. 自定义代理名称
虽然 TypeScript 版本尚不支持随机名称，但您可以创建自定义命名方案：

```bash
# 编号方案
maestro prompt -a "claude:3" -t "任务"  # 创建 claude-1、claude-2、claude-3

# 不同的模型
maestro prompt -a "claude:1,gpt4:1,codex:1" -t "比较实现"
```

### 2. Tmux 集成
学习 tmux 基础知识以获得更好的控制：

```bash
# 附加到代理会话
tmux attach -t maestro-claude-1

# 切换窗口
Ctrl+b，然后 1  # Agent 窗口
Ctrl+b，然后 2  # Dev 窗口

# 分离
Ctrl+b，然后 d
```

### 3. Git 工作树管理
了解工作树结构：

```bash
# 列出所有工作树
git worktree list

# 手动访问代理工作
cd .maestro/worktrees/claude-1
git log
git diff main
```

### 4. 端口转发
用于远程开发：

```bash
# 转发代理开发端口
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 user@host
```

### 5. 与 CI/CD 集成
在集成前对所有代理运行测试：

```bash
# 创建测试脚本
echo '#!/bin/bash
maestro run "npm test" || exit 1
maestro run "npm run lint" || exit 1
maestro run "npm run build" || exit 1
' > test-all-agents.sh

chmod +x test-all-agents.sh
./test-all-agents.sh
```

## 结论

Maestro 通过实现真正的并行开发，改变了开发者与 AI 编程助手的工作方式。通过利用 Git 工作树和 tmux 会话，它为管理同时在您的代码库上工作的多个 AI 代理提供了一个强大的框架。

关键要点：
- 从清晰、具体的任务开始
- 使用自动模式以实现流畅操作
- 经常创建检查点
- 监控资源使用
- 保持主分支干净

使用 Maestro，您可以通过让多个 AI 助手并行处理项目的不同方面来显著加速开发，同时保持代码质量并防止冲突。