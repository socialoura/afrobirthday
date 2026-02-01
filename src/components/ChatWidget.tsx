"use client";

import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const quickReplies = [
  "How to order?",
  "Track my order",
  "Refund policy",
];

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hi! 👋 How can we help you today?",
      sender: "bot",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQuickReply = (reply: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), text: reply, sender: "user" },
      {
        id: Date.now() + 1,
        text: getAutoResponse(reply),
        sender: "bot",
      },
    ]);
  };

  const getAutoResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes("order") && lowerQuery.includes("how")) {
      return "It's easy! Just fill out the form on our homepage, upload a photo, add your message, and pay. You'll receive your video within 24-48 hours! 🎂";
    }
    if (lowerQuery.includes("track")) {
      return "We'll email you a confirmation after your order. Your video will be delivered to your email within 24-48 hours. Need help? Email us at support@afrobirthday.com";
    }
    if (lowerQuery.includes("refund")) {
      return "We offer a 100% money-back guarantee within 7 days if you're not satisfied. Just email support@afrobirthday.com with your order ID.";
    }
    return "Thanks for your message! Our team will get back to you soon. For faster response, email us at support@afrobirthday.com 📧";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSubmitting) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), text: userMessage, sender: "user" },
    ]);

    setIsSubmitting(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: getAutoResponse(userMessage),
          sender: "bot",
        },
      ]);
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-5 right-5 z-50 w-14 h-14 bg-primary rounded-full shadow-lg",
          "flex items-center justify-center text-white",
          "hover:bg-primary-600 transition-all duration-300",
          "animate-pulse hover:animate-none",
          isOpen && "hidden"
        )}
        aria-label="Open chat"
      >
        <MessageCircle size={28} />
      </button>

      {/* Chat Window */}
      <div
        className={cn(
          "fixed bottom-5 right-5 z-50 w-[350px] max-w-[calc(100vw-40px)]",
          "bg-white rounded-2xl shadow-2xl overflow-hidden",
          "transition-all duration-300 transform",
          isOpen
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="bg-primary text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold">AfroBirthday Support 🎂</h3>
            <p className="text-sm text-white/80">We typically reply instantly</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Close chat"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="h-[300px] overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[80%] p-3 rounded-2xl text-sm",
                message.sender === "bot"
                  ? "bg-white shadow-sm rounded-bl-none"
                  : "bg-primary text-white ml-auto rounded-br-none"
              )}
            >
              {message.text}
            </div>
          ))}
          {isSubmitting && (
            <div className="bg-white shadow-sm rounded-2xl rounded-bl-none max-w-[80%] p-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          )}
        </div>

        {/* Quick Replies */}
        {messages.length === 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                onClick={() => handleQuickReply(reply)}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isSubmitting}
              className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
