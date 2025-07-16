import React, { useEffect, useRef, useState } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, User, Volume2, VolumeX } from 'lucide-react';
import { User as UserType } from '../services/api';

interface CallInterfaceProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callType: 'audio' | 'video';
  otherUser: UserType;
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
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [remoteAudioPlaying, setRemoteAudioPlaying] = useState(false);
  const [remoteVideoPlaying, setRemoteVideoPlaying] = useState(false);
  
  // Set up local video
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      console.log('📹 Setting up local video');
      const videoElement = localVideoRef.current;
      
      videoElement.srcObject = localStream;
      videoElement.muted = true; // Prevent feedback
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      
      videoElement.onloadedmetadata = () => {
        console.log('📺 Local video metadata loaded');
        videoElement.play().catch(console.error);
      };
    }
  }, [localStream]);
  
  // Set up remote video and audio - CRITICAL
  useEffect(() => {
    if (remoteStream) {
      console.log('🎵 Setting up remote stream:', {
        id: remoteStream.id,
        active: remoteStream.active,
        audioTracks: remoteStream.getAudioTracks().length,
        videoTracks: remoteStream.getVideoTracks().length
      });
      
      // Set up remote video element
      if (remoteVideoRef.current) {
        console.log('📺 Configuring remote video element');
        const videoElement = remoteVideoRef.current;
        
        videoElement.srcObject = remoteStream;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.muted = false; // We want audio from video element
        videoElement.volume = 1.0;
        
        videoElement.onloadedmetadata = () => {
          console.log('📺 Remote video metadata loaded');
          videoElement.play().then(() => {
            console.log('✅ Remote video playing');
            setRemoteVideoPlaying(true);
          }).catch(error => {
            console.error('❌ Remote video play error:', error);
            // Try to play on user interaction
            const playOnClick = () => {
              videoElement.play().then(() => {
                console.log('✅ Remote video playing after user interaction');
                setRemoteVideoPlaying(true);
              });
              document.removeEventListener('click', playOnClick);
            };
            document.addEventListener('click', playOnClick, { once: true });
          });
        };

        videoElement.onplay = () => {
          console.log('▶️ Remote video started playing');
          setRemoteVideoPlaying(true);
        };

        videoElement.onpause = () => {
          console.log('⏸️ Remote video paused');
          setRemoteVideoPlaying(false);
        };
      }
      
      // Set up dedicated remote audio element for better audio control
      if (remoteAudioRef.current) {
        console.log('🔊 Configuring remote audio element');
        const audioElement = remoteAudioRef.current;
        
        audioElement.srcObject = remoteStream;
        audioElement.autoplay = true;
        audioElement.volume = 1.0;
        audioElement.muted = false;
        
        audioElement.oncanplay = () => {
          console.log('🔊 Remote audio can play');
          audioElement.play().then(() => {
            console.log('✅ Remote audio playing');
            setRemoteAudioPlaying(true);
          }).catch(error => {
            console.error('❌ Remote audio play error:', error);
            // Try to play on user interaction
            const playOnClick = () => {
              audioElement.play().then(() => {
                console.log('✅ Remote audio playing after user interaction');
                setRemoteAudioPlaying(true);
              });
              document.removeEventListener('click', playOnClick);
            };
            document.addEventListener('click', playOnClick, { once: true });
          });
        };

        audioElement.onplay = () => {
          console.log('▶️ Remote audio started playing');
          setRemoteAudioPlaying(true);
        };

        audioElement.onpause = () => {
          console.log('⏸️ Remote audio paused');
          setRemoteAudioPlaying(false);
        };

        audioElement.onerror = (error) => {
          console.error('❌ Remote audio error:', error);
        };
      }
      
      // Monitor track states
      remoteStream.getTracks().forEach((track, index) => {
        console.log(`🎵 Remote track ${index}:`, {
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          label: track.label
        });
        
        track.onended = () => console.log(`🔚 Remote ${track.kind} track ended`);
        track.onmute = () => console.log(`🔇 Remote ${track.kind} track muted`);
        track.onunmute = () => console.log(`🔊 Remote ${track.kind} track unmuted`);
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
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
        console.log(`🎤 Local audio ${track.enabled ? 'enabled' : 'disabled'}`);
      });
      setIsMuted(!isMuted);
    }
  };
  
  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
        console.log(`📹 Local video ${track.enabled ? 'enabled' : 'disabled'}`);
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const toggleRemoteAudio = () => {
    const newMutedState = !isRemoteAudioMuted;
    
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = newMutedState;
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = newMutedState;
    }
    
    setIsRemoteAudioMuted(newMutedState);
    console.log(`🔊 Remote audio ${newMutedState ? 'muted' : 'unmuted'}`);
  };
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getAvatarColor = (username: string) => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'];
    const index = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };
  
  const UserAvatar: React.FC<{ username: string; size?: 'small' | 'large' }> = ({ 
    username, 
    size = 'large' 
  }) => {
    const sizeClasses = size === 'large' ? 'w-32 h-32 text-4xl' : 'w-16 h-16 text-2xl';
    
    return (
      <div className={`${getAvatarColor(username)} ${sizeClasses} rounded-full flex items-center justify-center text-white font-bold shadow-lg`}>
        {username.charAt(0).toUpperCase()}
      </div>
    );
  };
  
  const hasRemoteVideo = remoteStream?.getVideoTracks().some(track => track.enabled) || false;
  const hasRemoteAudio = remoteStream?.getAudioTracks().some(track => track.enabled) || false;
  const hasLocalVideo = localStream?.getVideoTracks().some(track => track.enabled && !isVideoOff) || false;
  
  return (
    <div className="fixed inset-0 bg-gray-900 z-50">
      {/* Hidden audio element for remote audio - CRITICAL */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ display: 'none' }}
      />
      
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
          
          {/* Status indicators */}
          <div className="flex items-center space-x-2 text-xs">
            <span className={`px-2 py-1 rounded ${remoteAudioPlaying ? 'bg-green-600' : 'bg-red-600'} text-white`}>
              🎵 Audio: {remoteAudioPlaying ? 'Playing' : 'No Audio'}
            </span>
            {callType === 'video' && (
              <span className={`px-2 py-1 rounded ${remoteVideoPlaying ? 'bg-blue-600' : 'bg-red-600'} text-white`}>
                📹 Video: {remoteVideoPlaying ? 'Playing' : 'No Video'}
              </span>
            )}
          </div>
        </div>
        
        {/* Video Area */}
        <div className="flex-1 relative">
          {callType === 'video' ? (
            <>
              {/* Remote Video (Main) */}
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                {hasRemoteVideo && remoteVideoPlaying ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center space-y-4">
                    <UserAvatar username={otherUser.username} size="large" />
                    <div className="text-center">
                      <h3 className="text-white text-xl font-medium">{otherUser.username}</h3>
                      <p className="text-gray-400">
                        {hasRemoteAudio ? 'Camera is off' : 'Connecting...'}
                      </p>
                      <p className={`text-sm mt-1 ${remoteAudioPlaying ? 'text-green-400' : 'text-red-400'}`}>
                        🎵 Audio: {remoteAudioPlaying ? 'Playing' : 'Not Playing'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Local Video (Picture-in-Picture) */}
              <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-lg border-2 border-gray-600">
                {hasLocalVideo ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <UserAvatar username="You" size="small" />
                      <p className="text-gray-400 text-xs mt-2">Camera off</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Audio Call Interface */
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <UserAvatar username={otherUser.username} size="large" />
                <h3 className="text-white text-xl font-medium mt-4">{otherUser.username}</h3>
                <p className="text-gray-300 mt-2">{formatDuration(callDuration)}</p>
                <p className={`text-sm mt-2 ${remoteAudioPlaying ? 'text-green-400' : 'text-red-400'}`}>
                  🎵 Audio: {remoteAudioPlaying ? 'Playing' : 'Not Playing'}
                </p>
              </div>
            </div>
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
              {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
            </button>
            
            {callType === 'video' && (
              <button
                onClick={toggleVideo}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-700'
                }`}
                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
              >
                {isVideoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
              </button>
            )}

            <button
              onClick={toggleRemoteAudio}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isRemoteAudioMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-700'
              }`}
              title={isRemoteAudioMuted ? 'Unmute speaker' : 'Mute speaker'}
            >
              {isRemoteAudioMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
            </button>
            
            <button
              onClick={onEndCall}
              className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
              title="End call"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
          
          {/* Debug info */}
          <div className="mt-4 text-center text-xs text-gray-400">
            Local: {hasLocalVideo ? '📹' : '❌'} Video, 🎤 Audio | 
            Remote: {hasRemoteVideo ? '📹' : '❌'} Video, {remoteAudioPlaying ? '🔊' : '❌'} Audio
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallInterface;