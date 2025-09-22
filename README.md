# @asthestarslept/iteration-cli

[![npm version](https://badge.fury.io/js/@asthestarslept%2Fiteration-cli.svg)](https://badge.fury.io/js/@asthestarslept%2Fiteration-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)

一个强大的迭代管理CLI工具，专为长城后端项目设计，支持创建迭代、管理CR申请单和智能Git差异分析。

## ✨ 核心功能

- 🚀 **交互式界面** - 基于inquirer.js的用户友好CLI体验
- 📊 **智能Git分析** - 自动检测组件和功能模块变更
- 🔗 **多项目支持** - 一个迭代中创建不同项目的CR申请单
- 🎯 **智能分类** - 基于文件类型和目录结构自动分类变更
- 🛠️ **配置管理** - 简单的设置和配置管理
- 🔍 **调试工具** - 全面的调试和诊断功能
- 🧠 **智能缓存** - 自动记录用户习惯，优化选择体验
- 🚀 **批量分配** - 支持多种审查人员分配策略
- 👤 **自动创建人** - 首次选择后自动保存，后续自动使用

## 📦 安装

### 全局安装（推荐）

```bash
npm install -g @asthestarslept/iteration-cli
```

### 验证安装

```bash
fiter --version
fiter --help
```

## 🚀 快速开始

### 1. 查看配置状态

```bash
fiter config show
```

工具会自动使用环境变量配置，无需手动设置。

### 2. 创建迭代

```bash
fiter create
```

按照交互式提示完成迭代和CR申请单创建。

### 3. 调试和故障排除

```bash
fiter debug
```

使用调试命令检查配置和测试API连接。

## 🔧 主要命令

### `fiter create`

创建迭代的主要命令，包含：

- 📝 收集迭代基础信息
- 📁 项目信息获取
- 🧩 智能组件模块分析
- ⚙️ 智能功能模块分析
- 📄 CR申请单生成

**选项：**

```bash
fiter create --dir /path/to/project  # 指定工作目录
```

### `fiter config`

配置管理命令：

- `fiter config show` - 显示当前配置
- `fiter config check` - 检查配置完整性

### `fiter debug`

调试工具命令，包含多个子命令：

- `fiter debug git` - 检查Git信息获取
- `fiter debug api` - 测试API连接
- `fiter debug env` - 显示环境信息
- `fiter debug cache` - 显示用户选择缓存状态
- `fiter debug user` - 管理保存的创建人信息
- `fiter debug reset` - 重置所有缓存和配置

## 🎯 智能功能

### Git差异分析

- 🔍 自动检测变更文件
- 🏷️ 智能分类组件和功能模块
- 📁 多文件类型识别支持
- 🗂️ 基于目录结构的智能分类

### 组件检测

- 🧩 自动识别Vue、React、Svelte组件
- 📝 支持PascalCase命名检测
- 📂 基于目录路径的组件分类

### 功能模块检测

- 📄 **页面模块**：`/pages/`、`/views/`
- 🔌 **API服务**：`/api/`、`/services/`
- 🛠️ **工具函数**：`/utils/`、`/helpers/`
- 📊 **状态管理**：`/store/`、`/stores/`
- ⚙️ **功能模块**：`/features/`、`/modules/`

### 智能用户选择

- ⭐ **最近使用优先** - 常用人员排在前面并标记
- 📝 **自动预选** - 基于历史选择自动预选人员
- 💾 **偏好记忆** - 记录文件类型的审查人员偏好
- 👤 **自动创建人** - 首次选择后自动保存和使用

### 批量审查人员分配

- 🚀 **统一分配** - 所有文件分配给同一人
- 🎯 **按类型分配** - 根据文件扩展名智能分配
- 📁 **按目录分配** - 根据目录结构分配
- ✏️ **个别调整** - 支持批量分配后的微调

## 🛠️ 技术栈

- **TypeScript** - 类型安全的开发体验
- **Commander.js** - 命令行接口框架
- **Inquirer.js** - 交互式命令行界面
- **Simple-git** - Git操作库
- **Chalk** - 终端文字样式
- **Ora** - 优雅的命令行加载动画
- **Axios** - HTTP客户端
- **fs-extra** - 增强的文件系统操作

## ⚙️ 配置说明

配置文件位置：`~/.fshows/config.json`

### 配置项

```json
{
  "apiBaseUrl": "API基础URL",
  "apiKey": "用于认证的API密钥",
  "defaultWorkDir": "默认工作目录"
}
```

## 💻 开发说明

### 环境要求

- Node.js >= 16.0.0
- TypeScript 5.0+
- Git

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/ursazoo/iteration-cli.git
cd iteration-cli

# 安装依赖
npm install

# 构建项目
npm run build

# 开发模式
npm run dev

# 本地测试
npm link
fiter --help
```

### 项目结构

```
src/
├── cli.ts              # CLI主入口
├── commands/           # 命令实现
│   ├── create.ts       # 创建迭代命令
│   ├── config.ts       # 配置管理
│   └── debug.ts        # 调试工具
├── lib/                # 核心库
│   ├── greatwall-client.ts     # API客户端
│   └── greatwall-services.ts   # API服务
├── utils/              # 工具函数
│   ├── config.ts       # 配置管理
│   └── git.ts          # Git操作
└── types/              # TypeScript类型定义
    └── index.ts
```

## 📄 文档

- [详细使用指南](./docs/使用指南.md) - 完整的中文使用指南
- [GitHub仓库](https://github.com/ursazoo/iteration-cli)
- [npm包](https://www.npmjs.com/package/@asthestarslept/iteration-cli)

## 🤝 贡献

欢迎贡献代码！请随时提交Pull Request。

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个Pull Request

## 📞 支持

- **问题反馈**: [GitHub Issues](https://github.com/ursazoo/iteration-cli/issues)
- **使用文档**: [使用指南](./docs/使用指南.md)

## 更新日志

### v1.1.0 (2025-09-22)

- 🧠 **智能用户选择缓存** - 自动记录用户习惯，优化选择体验
- 🚀 **批量审查人员分配** - 支持多种分配策略，大幅提升效率
- 👤 **自动创建人检测** - 首次选择后自动保存，后续自动使用
- 🔄 **完全重置功能** - 支持清空所有缓存重新初始化
- 📊 **增强的调试工具** - 新增缓存状态、用户管理等调试命令
- ⭐ **用户体验优化** - 常用人员优先显示，减少操作步骤

### v1.0.0 (2025-09-18)

- 首次发布
- 支持迭代创建和管理
- 智能CR申请单生成
- Git差异分析功能
- 多项目支持
- 完整的配置管理

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。
