import express from 'express'
import expressProxy from 'express-http-proxy'
import dotenv from 'dotenv'
import cors from 'cors'

dotenv.config({path: './.env'})

const app = express()

// Middleware
app.use(cors())
// app.use(express.json())

app.use('/user-service', expressProxy(process.env.USER_SERVICE_URL));
app.use('/news-service', expressProxy(process.env.NEWS_SERVICE_URL));
app.use('/ai-service', expressProxy(process.env.AI_SERVICE_URL));

// Error handling
app.use((err, req, res, next) => {
  console.error('Gateway Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Gateway server listening on port ${PORT}`)
})