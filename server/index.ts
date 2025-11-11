import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { PORT } from './config'
import { agentRouter } from './routes/agent'
import { errorHandler } from './middlewares/errorHandler'

const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))
app.use('/api/agent', agentRouter)

// 错误处理中间件（需放在路由之后）
app.use(errorHandler)

// 启动成功后输出提示，方便定位端口与路由
app.listen(PORT, () => {
  console.log(`✅ 文档智能体服务已启动，端口 ${PORT}，接口前缀 /api/agent`)
})
