# 长城后端迭代管理CLI工具

基于 Node.js 和 TypeScript 开发的命令行迭代管理工具，提供完整的迭代创建流程。

## 核心功能

- ✅ **交互式界面** - 使用 inquirer.js 实现用户友好的交互流程
- ✅ **Git信息自动获取** - 使用 simple-git 智能获取项目信息  
- ✅ **智能工时计算** - 基于Git提交历史自动计算预估工时
- ✅ **长城后端集成** - 完整的长城后端API集成
- ✅ **配置管理** - 支持本地配置文件管理
- ✅ **调试工具** - 内置调试和诊断功能

## 快速开始

### 本地开发安装

```bash
# 克隆项目
git clone <repository-url>
cd fshows-iteration-cli

# 安装依赖
npm install

# 构建TypeScript
npm run build

# 本地安装测试
npm link
```

### NPM包安装

```bash
npm install -g fshows-iteration-cli
```

## 基本使用

### 创建迭代

使用交互式界面创建迭代：

```bash
# 使用当前目录创建迭代
fiter create

# 指定工作目录
fiter create --dir /path/to/project

# 查看当前配置
fiter config show

# 检查配置状态
fiter config check
```

## 命令详解

### `fiter create`

交互式创建迭代，包含以下5个步骤：

1. **基础信息收集** - 项目组选择、迭代名称、上线时间等
2. **项目信息收集** - Git信息获取、参与人员、文档链接等
3. **组件模块管理** - 添加和管理组件信息
4. **功能模块管理** - 添加和管理功能描述
5. **信息确认提交** - 最终确认并提交到长城后端

**命令选项:**
- `-d, --dir <path>` - 指定工作目录

### `fiter config`

配置管理功能：

```bash
# 显示当前配置
fiter config show

# 检查配置状态  
fiter config check
```

### `fiter debug`

调试和诊断工具：

```bash
# 检查Git信息获取
fiter debug git

# 测试长城后端API连接
fiter debug api

# 显示环境信息
fiter debug env
```

## 环境变量配置

工具使用环境变量进行配置，无需手动设置：

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `AI_CR_API_BASE_URL` | `http://gw.fshows.com/api` | 长城后端API地址 |
| `API_KEY_PROD` | 内置密钥 | API访问密钥 |
| `DEFAULT_WORK_DIR` | 当前目录 | 默认工作目录 |

## 项目架构

### 目录结构

```
fshows-iteration-cli/
├── src/
│   ├── commands/          # 命令模块
│   │   ├── create.ts      # 创建迭代命令
│   │   ├── config.ts      # 配置管理命令
│   │   └── debug.ts       # 调试命令
│   ├── lib/               # 核心库
│   │   ├── greatwall-client.ts    # HTTP客户端
│   │   └── greatwall-services.ts  # 服务层
│   ├── utils/             # 工具函数
│   │   ├── git.ts         # Git工具
│   │   └── config.ts      # 配置管理
│   ├── types/             # 类型定义
│   │   └── index.ts
│   └── cli.ts             # CLI入口
├── bin/
│   └── fiter.js          # 可执行文件
└── dist/                 # 构建输出
```

### 开发调试

```bash
# 开发模式运行
npm run dev

# 构建项目
npm run build

# 运行测试
npm test
```

### 主要技术栈

- **CLI框架**: commander.js
- **交互式界面**: inquirer.js
- **Git操作**: simple-git
- **HTTP客户端**: axios (自定义客户端)
- **样式输出**: chalk
- **加载动画**: ora
- **文件操作**: fs-extra

## 与MCP工具对比

与原MCP项目的主要区别：

| 特性 | MCP版本 | CLI版本 | 改进 |
|------|---------|---------|------|
| Git信息获取 | 基于环境变量 | 使用simple-git | 更准确的项目检测 |
| 交互方式 | 基于MCPServer | 命令行界面 | 更友好的用户体验 |
| 部署安装 | 需要MCP配置 | npm全局安装 | 更简单的安装流程 |
| 长城后端集成 | 完整API支持 | 完整API支持 | 保持一致的功能性 |
| 调试支持 | 基于日志 | 专用调试命令 | 更便捷的问题排查 |

## 常见问题

### Git信息获取失败

```bash
# 检查Git状态
fiter debug git

# 确保在Git仓库中运行
cd /path/to/git/repository
fiter create
```

### API连接问题

```bash
# 测试API连接
fiter debug api

# 检查环境信息
fiter debug env
```

## 开源协议

MIT License

## 贡献指南

欢迎提交Issue和Pull Request

## 技术支持

如遇问题请提交Issue
