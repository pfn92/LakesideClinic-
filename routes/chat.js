const express = require('express');
const { getAssistantReply } = require('../services/assistantService');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const reply = await getAssistantReply(req.body && req.body.messages);
    res.json({ reply });
  } catch (error) {
    console.error('Assistant request failed:', error.message);
    const status = error instanceof TypeError ? 400 : 503;
    res.status(status).json({
      error: status === 400 ? error.message : 'The assistant is unavailable. Please call the clinic.',
    });
  }
});

module.exports = router;
