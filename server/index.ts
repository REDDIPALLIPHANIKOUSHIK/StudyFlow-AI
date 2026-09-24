Warning: truncated output (original token count: 1268)
Total output lines: 124

import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { GoogleGenAI } from '@google/…1168 tokens truncated…'API route not found.' }))
  app.get('*', (_req, res) => res.sendFile(resolve(staticDir, 'index.html')))
}

app.listen(port, '0.0.0.0', () => console.log(`StudyFlow API listening on port ${port}`))

