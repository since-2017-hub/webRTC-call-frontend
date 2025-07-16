import React, { useEffect, useRef, useState } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, User } from 'lucide-react';
import { User as UserType } from '../services/api';

interface CallInterfaceProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callType: 'audio' | 'video';
  otherUser: UserType; // Required - not nullable
  onEndCall: () => void;
}

const CallInterface: React.FC<CallInterfaceProps> = ({
  localStream,
  remoteStream,
  callType,
  otherUser,
  onEndCall,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  // Set up local video
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      console.log('📹 Local video stream set');
    }
  }, [localStream]);
  
  // Set up remote video/audio
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      
      // CRITICAL: Enable audio playback
      remoteVideoRef.current.volume = 1.0;
      remoteVideoRef.current.muted = false;
      remoteVideoRef.current.autoplay = true;
      
      // Force play for audio
      remoteVideoRef.current.play().then(() => {
        console.log('🔊 Remote audio/video playing');
      }).catch(error => {
        console.error('❌ Error playing remote stream:', error);
      });
      
      // Log audio tracks
      remoteStream.getAudioTracks().forEach(track => {
        console.log('🎵 Remote audio track:', track.label, 'enabled:', track.enabled);
      });
    }
  }, [remoteStream]);
  
  // Call duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        console.log('🎤 Local audio', track.enabled ? 'enabled' : 'disabled');
      });
      setIsMuted(!isMuted);
    }
  };
  
  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
        console.log('📹 Local video', track.enabled ? 'enabled' : 'disabled');
      });
      setIsVideoOff(!isVideoOff);
    }
  };
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="fixed inset-0 bg-gray-900 z-50">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-white font-medium">{otherUser.username}</h3>
              <p className="text-gray-300 text-sm">{formatDuration(callDuration)}</p>
            </div>
          </div>
          <div className="text-white text-sm">
            {callType === 'video' ? 'Video Call' : 'Voice Call'}
          </div>
        </div>
        
        {/* Video Area */}
        <div className="flex-1 relative">
          {callType === 'video' && (
            <>
              {/* Remote Video (Main) */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false} // CRITICAL: Not muted so we can hear them
                className="w-full h-full object-cover bg-gray-800"
              />
              
              {/* Local Video (Picture-in-Picture) */}
              <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted={true} // Muted to prevent feedback
                  className="w-full h-full object-cover"
                />
              </div>
            </>
          )}
          
          {callType === 'audio' && (
            <>
              {/* Hidden video element for audio */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false} // CRITICAL: Not muted for audio calls
                className="hidden"
              />
              
              {/* Audio Call UI */}
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-32 h-32 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-16 h-16 text-white" />
                  </div>
                  <h3 className="text-white text-xl font-medium mb-2">{otherUser.username}</h3>
                  <p className="text-gray-300">{formatDuration(callDuration)}</p>
                  <p className="text-gray-400 text-sm mt-2">Voice Call Active</p>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Controls */}
        <div className="bg-gray-800 px-6 py-6">
          <div className="flex items-center justify-center space-x-6">
            <button
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-700'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <MicOff className="w-6 h-6 text-white" />
              ) : (
                <Mic className="w-6 h-6 text-white" />
              )}
            </button>
            
            {callType === 'video' && (
              <button
                onClick={toggleVideo}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-700'
                }`}
                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
              >
                {isVideoOff ? (
                  <VideoOff className="w-6 h-6 text-white" />
                ) : (
                  <Video className="w-6 h-6 text-white" />
                )}
              </button>
            )}
            
            <button
              onClick={onEndCall}
              className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
              title="End call"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallInterface;