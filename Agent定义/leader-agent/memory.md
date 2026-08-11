# Leader Agent 记忆

> 本文件由 leader-agent 自动维护，记录项目背景、用户偏好和历史决策。
> 每次 leader-agent 启动时读取，任务结束后更新。

## 项目背景

### 技术栈
- 框架: Next.js 16（App Router），React 18.3，TypeScript 5.x
- UI: Tailwind CSS 3.4 + shadcn/ui + Lucide React
- 状态管理: Zustand
- 表单校验: React Hook Form + Zod
- 数据库: SQL Server + Prisma ORM 6.x

### 架构约束
- 所有数据库查询必须按 `ccorpcode` 过滤（多租户隔离）
- 禁止直接 `new PrismaClient()`，使用 `src/lib/prisma.ts` 单例
- 路径别名 `@/*` 映射到 `./src/*`，禁止相对路径跨模块导入
- 组件使用 `cn()` 合并类名
- 严格模式 TypeScript，避免 `any`

## 用户偏好

<!-- 领导Agent在对话中识别到用户明确表达的偏好时，记录在此处 -->

## 历史决策

<!-- 记录用户明确拍板的重要决策和被否决的方案 -->

## 活跃任务上下文

<!-- 当前进行中的任务摘要，用于跨会话恢复上下文 -->

