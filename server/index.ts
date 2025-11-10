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

app.listen(PORT)
