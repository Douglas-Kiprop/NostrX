const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
    const { prompt, language } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required.' });
    }

    try {
        // Placeholder for Gemini API integration
        // const geminiResponse = await gemini.generate(prompt, language);
        const aiResponse = `This is a placeholder AI response for: "${prompt}" in ${language}.`;
        res.json({ response: aiResponse });
    } catch (error) {
        console.error('Error generating AI response:', error);
        res.status(500).json({ error: 'Failed to generate AI response.' });
    }
});

module.exports = router;