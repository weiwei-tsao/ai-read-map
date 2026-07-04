import express from 'express'
import rateLimit from 'express-rate-limit'
import { readmapRouter } from './routes/readmap.js'

const app = express()
app.use(express.json({ limit: '2mb' }))

const limiter = rateLimit({ windowMs: 60_000, max: 20 })
app.use('/api', limiter, readmapRouter)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787
app.listen(PORT, () => console.log(`ai-read-map backend listening on :${PORT}`))
