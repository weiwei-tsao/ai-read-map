import express from 'express'

const app = express()
app.use(express.json({ limit: '2mb' }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787
app.listen(PORT, () => console.log(`ai-read-map backend listening on :${PORT}`))
