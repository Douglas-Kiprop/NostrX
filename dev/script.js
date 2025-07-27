document.addEventListener('DOMContentLoaded', () => {
    const chatArea = document.getElementById('chat-area');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const languageSelect = document.getElementById('language');

    // Log to verify NostrTools availability
    console.log('NostrTools:', window.NostrTools);

    // --- Smart Widget Handler Integration ---
    const isInsideIframe = window.self !== window.top;
    let parentOrigin = null;

    if (isInsideIframe && window.SWHandler) {
        try {
            // Attempt to get the parent origin for security.
            // This might throw an error if cross-origin ancestorOrigins is not accessible.
            parentOrigin = window.location.ancestorOrigins[0];
            window.SWHandler.client.ready(parentOrigin);
            console.log('Smart Widget Handler Client ready, notifying parent.');

            // Listen for messages from the parent (host)
            const listener = window.SWHandler.client.listen((data) => {
                console.log('Received message from parent (SWHandler):', data);
                if (data.kind === 'nostr-event') {
                    if (data.data.status === 'success') {
                        addMessage('Posted to Nostr (via parent)!', 'ai');
                        console.log('Event published successfully by parent:', data.data.event);
                    } else if (data.data.status === 'error') {
                        addMessage(`Error posting to Nostr (via parent): ${data.data.message}`, 'ai');
                        console.error('Parent failed to publish event:', data.data.message);
                    }
                } else if (data.kind === 'user-metadata') {
                    // Handle user metadata from the parent if needed
                    console.log('Received user metadata from parent:', data.data.user);
                    // Example: update a user info display if you have one
                    // updateUserInfo(data.data.user);
                } else if (data.kind === 'error') {
                    addMessage(`Error from parent: ${data.data}`, 'ai');
                }
            });

            // Clean up the listener if the component could unmount dynamically
            // (less critical for a simple single-page app, but good practice)
            // window.addEventListener('beforeunload', () => listener.close());

        } catch (error) {
            console.warn('Could not determine parent origin or initialize SWHandler listener:', error);
            // If parentOrigin is not accessible, SWHandler might still work with a wildcard target
            // but for requestEventPublish, a specific origin is preferred for security.
            // In this case, the fallback to NIP-07 will happen.
        }
    }
    // --- End Smart Widget Handler Integration ---

    // Initialize chat functionality regardless of nostr-tools
    sendBtn.addEventListener('click', async () => {
        const message = userInput.value.trim();
        if (message) {
            addMessage(message, 'user');
            userInput.value = '';
            try {
                const response = await fetch(`${window.BACKEND_URL}/query-agent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: message })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let aiResponse = '';
                let messageDiv = null;
                let jsonBuffer = ''; // Buffer to accumulate incomplete JSON chunks

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        if (jsonBuffer) {
                            // Try to parse any remaining buffered JSON
                            try {
                                const data = JSON.parse(jsonBuffer);
                                if (data.type === 'text' && data.content) {
                                    aiResponse += data.content;
                                    if (!messageDiv) {
                                        messageDiv = addMessage(aiResponse, 'ai', true);
                                    } else {
                                        messageDiv.textContent = aiResponse;
                                        chatArea.scrollTop = chatArea.scrollHeight;
                                    }
                                }
                            } catch (e) {
                                console.error('Final JSON buffer parse error:', e, 'buffer:', jsonBuffer);
                                addMessage('Warning: Incomplete response received.', 'ai');
                            }
                        }
                        if (aiResponse) {
                            if (!messageDiv) {
                                messageDiv = addMessage(aiResponse, 'ai');
                            }
                            // Add a "Post to Nostr" button
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
                    jsonBuffer += chunk; // Accumulate chunks

                    // Process complete lines
                    const lines = jsonBuffer.split('\n');
                    jsonBuffer = lines.pop(); // Keep the last (potentially incomplete) line in the buffer

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const jsonString = line.substring(6).trim();
                                if (!jsonString) continue; // Skip empty data lines
                                const data = JSON.parse(jsonString);
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
                                console.error('JSON parsing error for line:', line, 'error:', e);
                                addMessage('Warning: Skipping malformed response chunk.', 'ai');
                                // Continue processing instead of returning
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

    // Add Enter key support to send message
    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevent default behavior (e.g., newline)
            sendBtn.click(); // Trigger the existing send button logic
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
        const content = `User: ${userQuery}\nAI: ${aiResponse}\n\n#nostrchat`;
        const eventDraft = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'nostrchat']],
            content: content,
        };

        // Conditional logic: Use Smart Widget Handler if available and in iframe, else fallback to NIP-07
        if (isInsideIframe && window.SWHandler && parentOrigin) {
            addMessage('Attempting to publish to Nostr via parent client...', 'ai');
            try {
                // Request the parent to sign and publish the event
                // The parent (e.g., Iris) will handle the actual signing and publishing to relays.
                // Success/error feedback will come via the SWHandler.client.listen callback.
                window.SWHandler.client.requestEventPublish(eventDraft, parentOrigin);
            } catch (error) {
                console.error('Error requesting event publish via SWHandler:', error);
                addMessage('Error requesting publish via parent: ' + error.message, 'ai');
            }
        } else {
            // Fallback to NIP-07 if not in an iframe with SWHandler, or if parentOrigin is not accessible
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

                // Sign the event using NIP-07
                eventDraft.pubkey = await window.nostr.getPublicKey();
                const signedEvent = await window.nostr.signEvent(eventDraft);

                // Log the event for debugging
                console.log('Signed event (NIP-07):', signedEvent);

                // Publish to multiple relays using WebSocket
                let published = false;
                relays.forEach((url) => {
                    try {
                        const socket = new WebSocket(url);
                        socket.onopen = () => {
                            console.log(`Connected to ${url}`);
                            // Send the signed event in JSON format
                            socket.send(JSON.stringify(['EVENT', signedEvent]));
                        };
                        socket.onmessage = (message) => {
                            console.log(`Raw message from ${url}:`, message.data);
                            try {
                                const data = JSON.parse(message.data);
                                if (data[0] === 'OK' && data[1] === signedEvent.id) {
                                    console.log(`Event published to ${url}`);
                                    if (!published) {
                                        addMessage('Posted to Nostr (via NIP-07)!', 'ai');
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
                        setTimeout(() => { socket.close(); }, 2000);
                    } catch (error) {
                        console.error(`Error with relay ${url}:`, error);
                        addMessage(`Error with relay ${url}: ${error.message}`, 'ai');
                    }
                });
            } catch (error) {
                console.error('Error posting to Nostr (NIP-07):', error);
                addMessage('Error posting to Nostr: ' + error.message, 'ai');
            }
        }
    }

    // Add suggestion bubbles
    const suggestionBubblesContainer = document.getElementById('suggestion-bubbles');
    const suggestions = [
        { text: 'Nostr Threads', query: 'I want to generate Nostr threads' },
        { text: 'Nostr', query: 'What is Nostr' }
    ];

    suggestions.forEach(suggestion => {
        const bubble = document.createElement('div');
        bubble.classList.add('suggestion-bubble');
        bubble.textContent = suggestion.text;
        bubble.addEventListener('click', () => {
            userInput.value = suggestion.query;
            sendBtn.click(); // Simulate a click on the send button
        });
        suggestionBubblesContainer.appendChild(bubble);
    });
});