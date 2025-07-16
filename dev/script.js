document.addEventListener('DOMContentLoaded', () => {
    const chatArea = document.getElementById('chat-area');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const languageSelect = document.getElementById('language');

    // Log to verify NostrTools availability
    console.log('NostrTools:', window.NostrTools);

    // Initialize chat functionality regardless of nostr-tools
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
                let messageDiv = null;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        if (aiResponse) {
                            if (!messageDiv) {
                                messageDiv = addMessage(aiResponse, 'ai');
                            }
                            // Add a "Post to Nostr" button after the AI response
                            const postNostrBtn = document.createElement('button');
                            postNostrBtn.textContent = 'Post to Nostr';
                            postNostrBtn.classList.add('post-nostr-btn');
                            postNostrBtn.onclick = () => postToNostr(message, aiResponse);
                            messageDiv.appendChild(postNostrBtn);
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
                                    break;
                                } else if (data.type === 'error') {
                                    console.error('AI Error:', data.content);
                                    addMessage('Sorry, an error occurred: ' + data.content, 'ai');
                                    return;
                                } else if (data.type === 'text' && data.content) {
                                    aiResponse += data.content;
                                    if (!messageDiv) {
                                        messageDiv = addMessage(aiResponse, 'ai', true);
                                    } else {
                                        messageDiv.textContent = aiResponse;
                                        chatArea.scrollTop = chatArea.scrollHeight;
                                    }
                                } else if (data.type === 'tool_code' || data.type === 'tool_result') {
                                    console.log(`${data.type}:`, data.content);
                                } else if (data.type === 'thinking') {
                                    if (!messageDiv) {
                                        messageDiv = addMessage('AI is thinking...', 'ai', true);
                                    } else {
                                        messageDiv.textContent = 'AI is thinking...';
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
        if (isTemporary) messageDiv.classList.add('temporary');
        messageDiv.textContent = text;
        chatArea.appendChild(messageDiv);
        chatArea.scrollTop = chatArea.scrollHeight;
        return messageDiv;
    }

    // Function to post to Nostr
    async function postToNostr(userQuery, aiResponse) {
        if (!window.NostrTools) {
            addMessage('Nostr posting unavailable: nostr-tools library not loaded.', 'ai');
            console.error('nostr-tools not loaded.');
            return;
        }
        if (!window.nostr) {
            addMessage('NIP-07 extension (e.g., Alby, Nos2x) not found. Please install one to post to Nostr.', 'ai');
            return;
        }

        try {
            const relays = [
                'wss://relay.damus.io',
                'wss://nostr-01.yakihonne.com',
                'wss://relay.primal.net',
                'wss://nos.lol',
                'wss://relay.nostr.band'
            ];
            const content = `User: ${userQuery}\nAI: ${aiResponse}\n\n#nostrchat`;

            let event = {
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['t', 'nostrchat']],
                content: content,
            };

            // Sign the event using NIP-07
            event.pubkey = await window.nostr.getPublicKey();
            event = await window.nostr.signEvent(event);

            // Log the event for debugging
            console.log('Signed event:', event);

            // Publish to multiple relays using WebSocket
            let published = false;
            relays.forEach((url) => {
                try {
                    const socket = new WebSocket(url);

                    socket.onopen = () => {
                        console.log(`Connected to ${url}`);
                        // Send the signed event in JSON format
                        socket.send(JSON.stringify(['EVENT', event]));
                    };

                    socket.onmessage = (message) => {
                        console.log(`Raw message from ${url}:`, message.data);
                        try {
                            const data = JSON.parse(message.data);
                            if (data[0] === 'OK' && data[1] === event.id) {
                                console.log(`Event published to ${url}`);
                                if (!published) {
                                    addMessage('Posted to Nostr!', 'ai');
                                    published = true;
                                }
                            } else {
                                console.log(`Unexpected message from ${url}:`, data);
                            }
                        } catch (e) {
                            console.error(`Error parsing message from ${url}:`, e);
                        }
                    };

                    socket.onerror = (error) => {
                        console.error(`WebSocket error for ${url}:`, error);
                        addMessage(`Failed to connect to relay ${url}.`, 'ai');
                    };

                    socket.onclose = () => {
                        console.log(`Disconnected from ${url}`);
                    };

                    // Close the socket after a delay to ensure delivery
                    setTimeout(() => {
                        socket.close();
                    }, 2000);
                } catch (error) {
                    console.error(`Error with relay ${url}:`, error);
                    addMessage(`Error with relay ${url}: ${error.message}`, 'ai');
                }
            });
        } catch (error) {
            console.error('Error posting to Nostr:', error);
            addMessage('Error posting to Nostr: ' + error.message, 'ai');
        }
    }
});