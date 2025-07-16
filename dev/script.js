document.addEventListener('DOMContentLoaded', () => {
    const chatArea = document.getElementById('chat-area');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const languageSelect = document.getElementById('language');

    sendBtn.addEventListener('click', async () => {
        const message = userInput.value.trim();
        if (message) {
            addMessage(message, 'user');
            userInput.value = '';

            try {
                const response = await fetch('http://127.0.0.1:8080/query-agent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: message
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let aiResponse = '';
                let messageDiv = null; // To update the same AI message element

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        if (aiResponse) {
                            // Finalize the message if there's content
                            if (!messageDiv) {
                                addMessage(aiResponse, 'ai');
                            }
                        } else {
                            addMessage('No response from AI.', 'ai');
                        }
                        break;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.substring(6));
                                if (data.type === 'end') {
                                    break; // Stream ended
                                } else if (data.type === 'error') {
                                    console.error('AI Error:', data.content);
                                    addMessage('Sorry, an error occurred: ' + data.content, 'ai');
                                    return; // Exit the loop on error
                                } else if (data.type === 'text' && data.content) {
                                    // Append text content to aiResponse
                                    aiResponse += data.content;
                                    // Update UI incrementally
                                    if (!messageDiv) {
                                        messageDiv = addMessage(aiResponse, 'ai', true);
                                    } else {
                                        messageDiv.textContent = aiResponse;
                                        chatArea.scrollTop = chatArea.scrollHeight;
                                    }
                                } else if (data.type === 'tool_code' || data.type === 'tool_result') {
                                    // Optionally handle tool-related responses
                                    console.log(`${data.type}:`, data.content);
                                } else if (data.type === 'thinking') {
                                    // Optionally display thinking indicator
                                    if (!messageDiv) {
                                        messageDiv = addMessage('AI is thinking...', 'ai', true);
                                    }
                                }
                            } catch (e) {
                                console.error('JSON parsing error:', e, 'for line:', line);
                                addMessage('Sorry, something went wrong with the response format.', 'ai');
                                return;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Fetch error:', error);
                addMessage('Sorry, something went wrong. Please try again.', 'ai');
            }
        }
    });

    function addMessage(text, sender, isTemporary = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
        messageDiv.textContent = text;
        chatArea.appendChild(messageDiv);
        chatArea.scrollTop = chatArea.scrollHeight;
        return messageDiv; // Return the element for updates
    }
});