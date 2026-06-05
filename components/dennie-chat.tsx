"use client";

import React, { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
}

// Generate a random session ID so Voiceflow tracks context during a single visit
const SESSION_ID = `session_${Math.random().toString(36).substring(2, 11)}`;
const VOICEFLOW_API_KEY =
  process.env.NEXT_PUBLIC_VOICEFLOW_API_KEY || "YOUR_API_KEY_HERE";
const VERSION_ID = "production"; // or 'development'

export default function DennieChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "bot",
      text: "Hi! I'm the AI version of [Your Name]. Ask me anything about my experience, projects, or background!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Send the user message to Voiceflow's Interact API
      const response = await fetch(
        `https://voiceflow.com${SESSION_ID}/interact?versionID=${VERSION_ID}`,
        {
          method: "POST",
          headers: {
            Authorization: VOICEFLOW_API_KEY,
            "Content-Type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            request: {
              type: "text",
              payload: userMessage.text,
            },
          }),
        },
      );

      const data = await response.json();

      // Parse the rich trace response from Voiceflow
      const botMessages: Message[] = [];

      data.forEach((trace: any) => {
        if (trace.type === "speak" || trace.type === "text") {
          botMessages.push({
            id: Math.random().toString(),
            sender: "bot",
            text: trace.payload.message,
          });
        }
      });

      if (botMessages.length > 0) {
        setMessages((prev) => [...prev, ...botMessages]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: "bot",
            text: "I processed that, but didn't generate a text response.",
          },
        ]);
      }
    } catch (error) {
      console.error("Error communicating with Voiceflow:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "bot",
          text: "Sorry, I am having trouble connecting to my brain right now.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto border border-gray-200 rounded-lg shadow-lg flex flex-col h-[500px] bg-white dark:bg-zinc-900 dark:border-zinc-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 rounded-t-lg">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">
          Chat with Dennie
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>{" "}
          Powered by Voiceflow AI
        </p>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 text-sm ${
                msg.sender === "user"
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-gray-200 rounded-bl-none"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-zinc-800 text-gray-400 text-sm rounded-lg p-3 animate-pulse">
              Thinking...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t border-gray-200 dark:border-zinc-700 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about Dan..."
          className="flex-1 border border-gray-300 dark:border-zinc-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent dark:text-white"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
