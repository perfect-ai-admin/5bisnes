import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGoalMentor } from '@/components/hooks/useGoalMentor';
import GoalCompletionModal from '@/components/client/journey/GoalCompletionModal';
import {
  Send,
  Loader2,
  MessageCircle,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth } from '@/api/supabaseClient';

/**
 * Goal Mentor Chat Component
 * Communicates with N8N webhook for AI-powered goal tracking
 */
export default function GoalMentorChat({ goalCode, goalData, customerGoalId, onGoalComplete }) {
  const [user, setUser] = useState(null);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef(null);

  const mentor = useGoalMentor(user?.phone, user?.email, user?.full_name);

  // Load user data
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await auth.me();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (err) {
        console.error('Failed to load user:', err);
      }
    };
    loadUser();
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mentor.conversation]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || mentor.isLoading) return;

    const text = messageText;
    setMessageText('');

    await mentor.sendMessage(text, goalCode, mentor.goalState?.current_step || 1);
  };

  const handleStartGoal = async () => {
    await mentor.startGoal(goalCode);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">מנטור העסק שלך</h3>
            <p className="text-xs text-gray-500">
              {mentor.goalState?.status === 'completed' ? '✓ מטרה הושלמה' : 'עוזר להשגת יעדים'}
            </p>
          </div>
        </div>

        {mentor.goalState && (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-sm font-bold text-gray-900">{mentor.goalState.progress_percent}%</div>
              <div className="text-xs text-gray-500">התקדמות</div>
            </div>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <AnimatePresence mode="wait">
          {mentor.conversation.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-full flex flex-col items-center justify-center text-center"
            >
              <MessageCircle className="w-16 h-16 text-gray-300 mb-4" />
              <h4 className="font-bold text-gray-700 mb-2">ברוכים הבאים למנטור שלך</h4>
              <p className="text-sm text-gray-500 mb-6 max-w-xs">
                אני כאן לעזור לך להשיג את המטרות העסקיות שלך. בואו נתחיל!
              </p>
              {!mentor.goalState && (
                <Button
                  onClick={handleStartGoal}
                  disabled={mentor.isLoading}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                >
                  {mentor.isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      טוען...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      בואו נתחיל
                    </>
                  )}
                </Button>
              )}
            </motion.div>
          ) : (
            mentor.conversation.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
                    M
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-xs lg:max-w-md px-4 py-3 rounded-2xl whitespace-pre-wrap break-words',
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
                  )}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {mentor.goalState && mentor.goalState.status !== 'completed' && (
        <form
          onSubmit={handleSendMessage}
          className="px-6 py-4 bg-white border-t border-gray-200 flex gap-3"
        >
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="כתוב כאן..."
            disabled={mentor.isLoading}
            className="flex-1 bg-gray-50 border-gray-200 rounded-full"
            autoFocus
          />
          <Button
            type="submit"
            disabled={mentor.isLoading || !messageText.trim()}
            size="icon"
            className="bg-blue-600 hover:bg-blue-700 rounded-full flex-shrink-0"
          >
            {mentor.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      )}

      {/* Completion Modal */}
      <AnimatePresence>
        {mentor.goalState?.status === 'completed' && (
          <GoalCompletionModal
            goalName={goalData?.goal_name_he || `מטרה: ${mentor.goalState?.goal_code}`}
            pointsEarned={100}
            nextGoalName="המטרה הבאה שלך"
            onContinue={() => {
              window.location.href = '/JourneyDashboard';
            }}
            onLater={() => {
              window.location.href = '/JourneyDashboard';
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}