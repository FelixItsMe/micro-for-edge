const express = require('express')

const router = express.Router()

router.get('/', (req, res) => {
  res.send('We aore on posts')
})

router.get('/specific', (req, res) => {
  res.send('We aore on specific')
})

module.exports = router