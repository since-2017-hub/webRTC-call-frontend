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
  const [hasLocalVideo, setHasLocalVideo] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  
  // Set up local video stream
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      console.log('📹 Setting up local video stream');
      
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true; // Always mute local video to prevent feedback
      localVideoRef.current.autoplay = true;
      localVideoRef.current.playsInline = true;
      
      const videoTracks = localStream.getVideoTracks();
      const audioTracks = localStream.getAudioTracks();
      
      setHasLocalVideo(videoTracks.length > 0 && videoTracks[0].enabled);
      
      console.log('📊 Local stream setup:', {
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        videoEnabled: videoTracks[0]?.enabled,
        audioEnabled: audioTracks[0]?.enabled
      });

      // Handle video load
      localVideoRef.current.onloadedmetadata = () => {
        console.log('📺 Local video metadata loaded');
        localVideoRef.current?.play().catch(error => {
          console.error('❌ Error playing local video:', error);
        });
      };
    }
  }, [localStream]);
  
  // Set up remote stream (CRITICAL for audio/video)
  useEffect(() => {
    if (remoteStream) {
      console.log('🎵 Setting up remote stream:', {
        id: remoteStream.id,
        active: remoteStream.active,
        audioTracks: remoteStream.getAudioTracks().length,
        videoTracks: remoteStream.getVideoTracks().length
      });
      
      const videoTracks = remoteStream.getVideoTracks();
      const audioTracks = remoteStream.getAudioTracks();
      
      // Update state based on available tracks
      setHasRemoteVideo(videoTracks.length > 0 && videoTracks[0].enabled);
      setHasRemoteAudio(audioTracks.length > 0 && audioTracks[0].enabled);
      
      // Set up remote video element
      if (remoteVideoRef.current) {
        console.log('📺 Setting up remote video element');
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.autoplay = true;
        remoteVideoRef.current.playsInline = true;
        remoteVideoRef.current.muted = false; // Don't mute remote video - we want audio
        
        remoteVideoRef.current.onloadedmetadata = () => {
          console.log('📺 Remote video metadata loaded');
          remoteVideoRef.current?.play().then(() => {
            console.log('✅ Remote video playing successfully');
          }).catch(error => {
            console.error('❌ Error playing remote video:', error);
          });
        };

        remoteVideoRef.current.onplay = () => {
          console.log('▶️ Remote video started playing');
        };

        remoteVideoRef.current.onpause = () => {
          console.log('⏸️ Remote video paused');
        };
      }
      
      // Set up dedicated remote audio element for better audio control
      if (remoteAudioRef.current) {
        console.log('🔊 Setting up remote audio element');
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.autoplay = true;
        remoteAudioRef.current.volume = 1.0;
        remoteAudioRef.current.muted = false;
        
        // Handle audio events
        remoteAudioRef.current.onloadeddata = () => {
          console.log('🔊 Remote audio data loaded');
        };

        remoteAudioRef.current.oncanplay = () => {
          console.log('🔊 Remote audio can play');
          remoteAudioRef.current?.play().then(() => {
            console.log('✅ Remote audio playing successfully');
            setAudioPlaying(true);
          }).catch(error => {
            console.error('❌ Error playing remote audio:', error);
            // Try to play on user interaction
            const playAudio = () => {
              remoteAudioRef.current?.play().then(() => {
                console.log('✅ Remote audio playing after user interaction');
                setAudioPlaying(true);
                document.removeEventListener('click', playAudio);
              });
            };
            document.addEventListener('click', playAudio, { once: true });
          });
        };

        remoteAudioRef.current.onplay = () => {
          console.log('▶️ Remote audio started playing');
          setAudioPlaying(true);
        };

        remoteAudioRef.current.onpause = () => {
          console.log('⏸️ Remote audio paused');
          setAudioPlaying(false);
        };

        remoteAudioRef.current.onerror = (error) => {
          console.error('❌ Remote audio error:', error);
        };
      }
      
      // Monitor track states
      [...videoTracks, ...audioTracks].forEach((track, index) => {
        console.log(`🎵 Track ${index}:`, {
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          label: track.label || 'unlabeled'
        });
        
        track.onended = () => {
          console.log(`🔚 Remote ${track.kind} track ended`);
        };
        
        track.onmute = () => {
          console.log(`🔇 Remote ${track.kind} track muted`);
        };
        
        track.onunmute = () => {
          console.log(`🔊 Remote ${track.kind} track unmuted`);
        };
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
      setHasLocalVideo(!isVideoOff && videoTracks.length > 0);
    }
  };

  const toggleRemoteAudio = () => {
    const newMutedState = !isRemoteAudioMuted;
    
    // Mute/unmute both audio and video elements
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = newMutedState;
      console.log(`🔊 Remote audio element ${newMutedState ? 'muted' : 'unmuted'}`);
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = newMutedState;
      console.log(`📺 Remote video element ${newMutedState ? 'muted' : 'unmuted'}`);
    }
    
    setIsRemoteAudioMuted(newMutedState);
  };
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Generate avatar colors based on username
  const getAvatarColor = (username: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
      'bg-indigo-500', 'bg-red-500', 'bg-yellow-500', 'bg-teal-500'
    ];
    const index = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };
  
  // Avatar component for when video is not available
  const UserAvatar: React.FC<{ username: string; size?: 'small' | 'large' }> = ({ 
    username, 
    size = 'large' 
  }) => {
    const sizeClasses = size === 'large' 
      ? 'w-32 h-32 text-4xl' 
      : 'w-16 h-16 text-2xl';
    
    return (
      <div className={`${getAvatarColor(username)} ${sizeClasses} rounded-full flex items-center justify-center text-white font-bold shadow-lg`}>
        {username.charAt(0).toUpperCase()}
      </div>
    );
  };
  
  return (
    <div className="fixed inset-0 bg-gray-900 z-50">
      {/* Dedicated audio element for remote audio - CRITICAL for hearing audio */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        controls={false}
        style={{ display: 'none' }}
      />
      
      <div className="h-full flex flex-col">
        {/* Header with debug info */}
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
          <div className="flex items-center space-x-4">
            <div className="text-white text-sm">
              {callType === 'video' ? 'Video Call' : 'Voice Call'}
            </div>
            <div className="flex items-center space-x-2 text-xs">
              {hasRemoteAudio && (
                <span className={`px-2 py-1 rounded ${audioPlaying ? 'bg-green-600' : 'bg-yellow-600'} text-white`}>
                  🎵 {audioPlaying ? 'Audio Playing' : 'Audio Ready'}
                </span>
              )}
              {hasRemoteVideo && (
                <span className="px-2 py-1 rounded bg-blue-600 text-white">
                  📹 Video
                </span>
              )}
              {!hasRemoteAudio && !hasRemoteVideo && (
                <span className="px-2 py-1 rounded bg-red-600 text-white">
                  ⚠️ No Media
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Video Area */}
        <div className="flex-1 relative">
          {callType === 'video' && (
            <>
              {/* Remote Video (Main) */}
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                {hasRemoteVideo ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted={false}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error('❌ Remote video error:', e);
                    }}
                    onLoadStart={() => {
                      console.log('📺 Remote video loading started');
                    }}
                    onCanPlay={() => {
                      console.log('📺 Remote video can play');
                    }}
                    onPlay={() => {
                      console.log('▶️ Remote video playing');
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center space-y-4">
                    <UserAvatar username={otherUser.username} size="large" />
                    <div className="text-center">
                      <h3 className="text-white text-xl font-medium">{otherUser.username}</h3>
                      <p className="text-gray-400">
                        {hasRemoteAudio ? 'Camera is off' : 'Connecting...'}
                      </p>
                      {hasRemoteAudio && (
                        <p className="text-green-400 text-sm mt-1">
                          🎵 Audio: {audioPlaying ? 'Playing' : 'Ready'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Local Video (Picture-in-Picture) */}
              <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-lg border-2 border-gray-600">
                {hasLocalVideo && !isVideoOff ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted={true}
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }} // Mirror local video
                    onError={(e) => {
                      console.error('❌ Local video error:', e);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <UserAvatar username="You" size="small" />
                      <p className="text-gray-400 text-xs mt-2">
                        {isVideoOff ? 'Camera off' : 'No camera'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          
          {callType === 'audio' && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="mb-4">
                  <UserAvatar username={otherUser.username} size="large" />
                </div>
                <h3 className="text-white text-xl font-medium mb-2">{otherUser.username}</h3>
                <p className="text-gray-300">{formatDuration(callDuration)}</p>
                <div className="mt-4 space-y-2">
                  {hasRemoteAudio ? (
                    <p className={`text-sm ${audioPlaying ? 'text-green-400' : 'text-yellow-400'}`}>
                      🎵 Audio: {audioPlaying ? 'Playing' : 'Ready'}
                    </p>
                  ) : (
                    <p className="text-red-400 text-sm">⚠️ No audio received</p>
                  )}
                </div>
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
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
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
              onClick={toggleRemoteAudio}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isRemoteAudioMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-700'
              }`}
              title={isRemoteAudioMuted ? 'Unmute speaker' : 'Mute speaker'}
            >
              {isRemoteAudioMuted ? (
                <VolumeX className="w-6 h-6 text-white" />
              ) : (
                <Volume2 className="w-6 h-6 text-white" />
              )}
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
            Remote: {hasRemoteVideo ? '📹' : '❌'} Video, {hasRemoteAudio ? (audioPlaying ? '🔊' : '🔇') : '❌'} Audio
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallInterface;