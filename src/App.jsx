import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- API Configuration (Mandatory Environment Style) ---
const MAX_RETRIES = 5;

// Utility function to convert File object to Base64 string
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () =>
      resolve({
        data: reader.result.split(',')[1],
        mimeType: file.type,
      });
    reader.onerror = (error) => reject(error);
  });
};

const App = () => {
  // --- State Management ---
  const [botState, setBotState] = useState('SETUP'); // 'SETUP' or 'CHATTING'
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [setupConfig, setSetupConfig] = useState({
    purpose:
      'Act as a friendly, knowledgeable, and concise customer service representative.',
    simulatedUrlContent:
      'Company Name: OmniCorp. Products: AI Assistants, Drones, Premium Coffee. Hours: Mon-Fri 9am-5pm. Shipping: Free over $50. Returns: 30 days, unused items only.',
    customQnA:
      'Q: Do you offer discounts? A: We offer a 10% discount for first-time buyers. Q: Can I track my order? A: Yes, a tracking link is emailed after purchase.',
  });

  const chatHistoryRef = useRef(null);

  const themeStyle = {
    '--color-primary': '#4f46e5',
    '--color-primary-hover': '#4338ca',
  };

  // --- Scroll to bottom when chat updates ---
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // --- Generate System Instruction ---
  const getSystemInstruction = useCallback(() => {
    const { purpose, simulatedUrlContent, customQnA, location } = setupConfig;
    return `
      ${purpose}

      --- KNOWLEDGE BASE (FROM URL & CUSTOM DATA) ---
      The following information was gathered from the company website URL and custom Q&A pairs:

      ${simulatedUrlContent}

      [CUSTOM Q&A / FINE-TUNING]:
      ${customQnA}

      [LOCATION INTEGRATION]:
      The business is located in ${location || 'an unspecified location'}.

      --- INSTRUCTIONS ---
      1. Prioritize the KNOWLEDGE BASE for all answers.
      2. Use image analysis if the user uploads one.
      3. Include regional context if relevant.
      4. Respond concisely and professionally.
    `;
  }, [setupConfig]);

  // --- Main API Call ---
  const handleSendMessage = async () => {
    const prompt = userInput.trim();
    if (!prompt && !imageFile) return;

    setIsLoading(true);
    setUserInput('');

    const newUserMessage = {
      role: 'user',
      parts: [{ text: prompt }],
    };

    let imagePart = null;
    let base64Data = null;

    if (imageFile) {
      try {
        base64Data = await fileToBase64(imageFile);
        imagePart = {
          inlineData: {
            mimeType: base64Data.mimeType,
            data: base64Data.data,
          },
        };
        newUserMessage.parts.unshift(imagePart);
        if (!prompt) newUserMessage.parts.push({ text: 'Analyze this image.' });
        setImageFile(null);
      } catch (error) {
        console.error('Error processing image file:', error);
      }
    }

    setChatHistory((prev) => [...prev, newUserMessage]);

    const contents = [...chatHistory, newUserMessage].map((msg) => ({
      role: msg.role,
      parts: msg.parts.map((part) => ({
        text: part.text,
        inlineData: part.inlineData ? part.inlineData : undefined,
      })),
    }));

    const payload = {
      contents: contents,
      systemInstruction: { parts: [{ text: getSystemInstruction() }] },
      tools: [{ google_search: {} }],
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: payload }),
      });

      const data = await response.json();

      if (response.ok) {
        const responseText =
          data.reply || "Sorry, I couldn't process that request.";
        setChatHistory((prev) => [
          ...prev,
          { role: 'model', parts: [{ text: responseText }] },
        ]);
      } else {
        throw new Error(data.error || 'Something went wrong with the API.');
      }
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        { role: 'model', parts: [{ text: err.message }] },
      ]);
    }

    setIsLoading(false);
  };

  // --- Chat Window ---
  const renderChatWindow = () => (
    <div
      className="flex flex-col h-full bg-white rounded-xl shadow-2xl border border-gray-100 ring-4 ring-indigo-500/50"
      style={themeStyle}
    >
      <div className="p-4 bg-[--color-primary] text-white rounded-t-xl flex justify-between items-center shadow-lg">
        <h3 className="text-xl font-bold">Omni-Bot Live Chat</h3>
        <button
          onClick={() => setBotState('SETUP')}
          className="text-sm px-3 py-1 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition font-medium"
        >
          Edit Config
        </button>
      </div>

      <div
        ref={chatHistoryRef}
        className="flex-grow p-4 space-y-4 overflow-y-auto custom-scrollbar bg-gray-50"
      >
        <div className="flex justify-start">
          <div className="max-w-[80%] p-3 rounded-xl shadow-md text-sm bg-indigo-600 text-white rounded-bl-sm animate-fade-in-down">
            Hello! I’m running with your custom settings. Ask me anything about
            your business.
          </div>
        </div>

        {chatHistory.map((msg, i) => {
          const textPart = msg.parts.find((p) => p.text)?.text || '';
          const imagePart = msg.parts.find((p) => p.inlineData);
          const isUser = msg.role === 'user';
          const imageSrc = imagePart
            ? `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
            : null;

          return (
            <div
              key={i}
              className={`flex ${
                isUser ? 'justify-end' : 'justify-start'
              } animate-fade-in`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-xl shadow-lg text-sm whitespace-pre-wrap ${
                  isUser
                    ? 'bg-[--color-primary] text-white rounded-br-sm'
                    : 'bg-gray-200 text-gray-800 rounded-bl-sm'
                }`}
              >
                {imageSrc && (
                  <div className="mb-2 p-1 border border-gray-300 bg-white rounded-lg">
                    <img
                      src={imageSrc}
                      alt="Uploaded context"
                      className="max-h-40 w-auto object-contain rounded-md"
                    />
                  </div>
                )}
                {textPart}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start animate-pulse">
            <div className="max-w-[80%] p-3 rounded-xl shadow-md text-sm bg-gray-200 text-gray-800 rounded-bl-sm">
              Bot is thinking...
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 bg-white rounded-b-xl">
        <div className="mb-3 flex items-center justify-between">
          <label
            htmlFor="image-upload"
            className={`flex items-center space-x-2 text-sm cursor-pointer font-medium ${
              imageFile
                ? 'text-indigo-600'
                : 'text-[--color-primary] hover:text-[--color-primary-hover]'
            }`}
          >
            <span>
              {imageFile
                ? `Attached: ${imageFile.name}`
                : 'Attach Image (Multimodal)'}
            </span>
          </label>
          <input
            type="file"
            id="image-upload"
            accept="image/*"
            className="hidden"
            onChange={(e) => setImageFile(e.target.files[0])}
          />
          {imageFile && (
            <button
              onClick={() => setImageFile(null)}
              className="text-xs text-red-500 hover:text-red-700 font-medium ml-2"
            >
              Remove
            </button>
          )}
        </div>

        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Ask your custom bot..."
            className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' &&
              (userInput.trim() || imageFile) &&
              !isLoading &&
              handleSendMessage()
            }
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || (!userInput.trim() && !imageFile)}
            className="bg-[--color-primary] text-white p-3 rounded-lg shadow-md hover:bg-[--color-primary-hover] disabled:opacity-50"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );

  // --- Setup Panel ---
  const renderSetupPanel = () => (
    <div
      className="p-6 bg-white rounded-xl shadow-2xl border border-gray-100 max-w-2xl mx-auto ring-4 ring-indigo-500/50"
      style={themeStyle}
    >
      <h2 className="text-3xl font-extrabold text-gray-900 mb-6">
        ⚙️ Omni-Bot Creator Setup
      </h2>
      <p className="text-gray-600 mb-6 border-b pb-4">
        Define your bot’s role, knowledge base, and integration location.
      </p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            1. Bot Purpose/Role
          </label>
          <textarea
            rows="3"
            value={setupConfig.purpose}
            onChange={(e) =>
              setSetupConfig({ ...setupConfig, purpose: e.target.value })
            }
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[--color-primary]"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            2. Simulated URL Content / File Upload
          </label>

          <textarea
            rows="3"
            placeholder="Enter company info, description, or paste a website URL..."
            value={setupConfig.simulatedUrlContent}
            onChange={(e) =>
              setSetupConfig({
                ...setupConfig,
                simulatedUrlContent: e.target.value,
              })
            }
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[--color-primary] mb-3"
          />

          <input
            type="file"
            accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.txt"
            onChange={(e) =>
              setSetupConfig({ ...setupConfig, simulatedFile: e.target.files[0] })
            }
            className="block w-full text-sm text-gray-700 border border-gray-300 rounded-lg cursor-pointer focus:ring-[--color-primary] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[--color-primary] file:text-white hover:file:bg-[--color-primary-dark]"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            3. Custom Q&A / Fine-Tuning
          </label>
          <textarea
            rows="5"
            value={setupConfig.customQnA}
            onChange={(e) =>
              setSetupConfig({ ...setupConfig, customQnA: e.target.value })
            }
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[--color-primary]"
          />
        </div>

        <div className="text-center mt-4">
          <button
            onClick={() => setBotState('CHATTING')}
            className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200"
          >
            🧠 Test / Preview Bot
          </button>
        </div>

        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-2">🌐 Integration</h3>
          <p className="text-sm text-gray-600 mb-2">
            Paste your website URL below and click{' '}
            <strong>“Integrate Chatbot”</strong> to generate the embed code
            instantly.
          </p>

          <div className="flex gap-2 mb-3">
            <input
              type="url"
              placeholder="https://your-website.com"
              value={setupConfig.websiteUrl}
              onChange={(e) =>
                setSetupConfig({ ...setupConfig, websiteUrl: e.target.value })
              }
              className="flex-grow p-2 border rounded-lg"
            />
            <button
              onClick={() => {
                if (!setupConfig.websiteUrl) {
                  alert('Please enter a website URL first!');
                  return;
                }
                const embedCode = `<iframe src="${window.location.origin}" style="width:400px; height:600px; border:none; border-radius:10px;"></iframe>`;
                navigator.clipboard.writeText(embedCode);
                alert(
                  '✅ Chatbot embed code copied! Paste it into your website’s HTML.'
                );
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Integrate Chatbot
            </button>
          </div>

          {setupConfig.websiteUrl && (
            <div className="text-xs text-gray-500 bg-white p-2 rounded-lg border">
              <strong>Generated Embed Code:</strong>
              <pre className="overflow-x-auto mt-1">{`<iframe src="${window.location.origin}" style="width:400px; height:600px; border:none; border-radius:10px;"></iframe>`}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // --- Render ---
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[85vh]">
        {botState === 'SETUP' ? renderSetupPanel() : renderChatWindow()}
      </div>
    </div>
  );
};

export default App;
