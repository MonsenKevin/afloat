import React, { useState } from 'react';
import { useCheckinStore } from '../../store/checkinStore';
import RoutingCard from './RoutingCard';

export default function CheckInFlow() {
  const { pendingCheckin, routingResult, isSubmitting, submitResponses } = useCheckinStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<string[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!pendingCheckin) return null;

  const questions = pendingCheckin.questions;
  const totalSteps = questions.length;
  const isLastStep = currentStep === totalSteps - 1;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Show routing result after submission
  if (routingResult) {
    return <RoutingCard routing={routingResult} sentimentScore={pendingCheckin.sentimentScore} />;
  }

  const handleNext = () => {
    if (!currentText.trim()) {
      setError('Please enter a response before continuing.');
      return;
    }
    setError(null);
    const updated = [...responses, currentText.trim()];
    setResponses(updated);
    setCurrentText('');
    setCurrentStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    if (!currentText.trim()) {
      setError('Please enter a response before submitting.');
      return;
    }
    setError(null);
    const finalResponses = [...responses, currentText.trim()];
    try {
      await submitResponses(finalResponses);
    } catch {
      setError('Submission failed. Please try again.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Progress header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">
            Question {currentStep + 1} of {totalSteps}
          </span>
          <span className="text-xs text-gray-400">Biweekly Check-in</span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-orange-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question + response */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-sky-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-sm text-gray-800 leading-relaxed font-medium">
              {questions[currentStep]}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-gray-500">Your response</label>
          <textarea
            value={currentText}
            onChange={(e) => {
              setCurrentText(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Share your thoughts…"
            rows={4}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none transition"
          />
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>
      </div>

      {/* Action button */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-gray-100">
        {isLastStep ? (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting…
              </>
            ) : (
              'Submit Check-in'
            )}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg text-sm transition"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
