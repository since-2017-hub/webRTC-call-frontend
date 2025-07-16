import React from 'react';
import { Phone, PhoneOff, Video, User } from 'lucide-react';
import { User as UserType } from '../services/api';

interface IncomingCallProps {
  caller: UserType;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCall: React.FC<IncomingCallProps> = ({
  caller,
  callType,
  onAccept,
  onReject,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform animate-pulse">
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-white" />
          </div>
          
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            Incoming {callType === 'video' ? 'Video' : 'Voice'} Call
          </h3>
          
          <p className="text-gray-600 mb-6">
            {caller.username} is calling you
          </p>
          
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={onReject}
              className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
            >
              <PhoneOff className="w-8 h-8 text-white" />
            </button>
            
            <button
              onClick={onAccept}
              className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-colors"
            >
              {callType === 'video' ? (
                <Video className="w-8 h-8 text-white" />
              ) : (
                <Phone className="w-8 h-8 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCall;