import React, { useEffect, useRef, useState } from "react";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import { User as UserType } from "../services/api";

interface CallInterfaceProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callType: "audio" | "video";
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

  // Set up local video
  useEffect(() => {
    console.log("localstream", localStream);
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;

      const videoTracks = localStream.getVideoTracks();
      setHasLocalVideo(videoTracks.length > 0 && videoTracks[0].enabled);

      console.log("📹 Local video stream set:", {
        videoTracks: videoTracks.length,
        audioTracks: localStream.getAudioTracks().length,
      });
    }
  }, [localStream]);

  // Set up remote video and audio
  useEffect(() => {
    if (remoteStream) {
      const videoTracks = remoteStream.getVideoTracks();
      const audioTracks = remoteStream.getAudioTracks();

      setHasRemoteVideo(videoTracks.length > 0 && videoTracks[0].enabled);
      setHasRemoteAudio(audioTracks.length > 0 && audioTracks[0].enabled);

      console.log("🎵 Remote stream received:", {
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        videoEnabled: videoTracks[0]?.enabled,
        audioEnabled: audioTracks[0]?.enabled,
      });

      // Set up video element for video calls
      if (callType === "video" && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.autoplay = true;
        remoteVideoRef.current.playsInline = true;
        remoteVideoRef.current.muted = false; // Enable audio in video element

        remoteVideoRef.current.onloadedmetadata = () => {
          console.log("📺 Remote video metadata loaded");
          remoteVideoRef.current?.play().catch((error) => {
            console.error("❌ Error playing remote video:", error);
          });
        };
      }

      // Set up dedicated audio element for better audio handling
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.autoplay = true;
        remoteAudioRef.current.volume = 1.0;
        remoteAudioRef.current.muted = false;

        remoteAudioRef.current.onloadeddata = () => {
          console.log("🔊 Remote audio loaded");
          remoteAudioRef.current
            ?.play()
            .then(() => {
              console.log("✅ Remote audio playing successfully");
            })
            .catch((error) => {
              console.error("❌ Error playing remote audio:", error);
              // Try to enable audio on user interaction
              document.addEventListener(
                "click",
                () => {
                  remoteAudioRef.current?.play();
                },
                { once: true }
              );
            });
        };
      }

      // Monitor track states
      [...videoTracks, ...audioTracks].forEach((track) => {
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
  }, [remoteStream, callType]);
  console.log(remoteStream);
  // Call duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
        console.log("🎤 Local audio", track.enabled ? "enabled" : "disabled");
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
        console.log("📹 Local video", track.enabled ? "enabled" : "disabled");
      });
      setIsVideoOff(!isVideoOff);
      setHasLocalVideo(!isVideoOff && localStream.getVideoTracks().length > 0);
    }
  };

  const toggleRemoteAudio = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !remoteAudioRef.current.muted;
      setIsRemoteAudioMuted(!isRemoteAudioMuted);
      console.log(
        "🔊 Remote audio",
        remoteAudioRef.current.muted ? "muted" : "unmuted"
      );
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !remoteVideoRef.current.muted;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Generate avatar colors based on username
  const getAvatarColor = (username: string) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-red-500",
      "bg-yellow-500",
      "bg-teal-500",
    ];
    const index = username
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  // Avatar component for when video is not available
  const UserAvatar: React.FC<{
    username: string;
    size?: "small" | "large";
  }> = ({ username, size = "large" }) => {
    const sizeClasses =
      size === "large" ? "w-32 h-32 text-4xl" : "w-16 h-16 text-2xl";

    return (
      <div
        className={`${getAvatarColor(
          username
        )} ${sizeClasses} rounded-full flex items-center justify-center text-white font-bold shadow-lg`}
      >
        {username.charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-900 z-50">
      {/* Hidden audio element for better audio handling */}
      {/* <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ display: "none" }}
      /> */}

      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-white font-medium">{otherUser.username}</h3>
              <p className="text-gray-300 text-sm">
                {formatDuration(callDuration)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-white text-sm">
              {callType === "video" ? "Video Call" : "Voice Call"}
              {!hasRemoteVideo && callType === "video" && (
                <span className="text-yellow-400 text-xs ml-2">
                  (Audio Only)
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {hasRemoteAudio && (
                <div className="text-green-400 text-xs">🎵 Audio</div>
              )}
              {hasRemoteVideo && (
                <div className="text-blue-400 text-xs">📹 Video</div>
              )}
            </div>
          </div>
        </div>

        {/* Video Area */}
        <div className="flex-1 relative">
          {callType === "video" && (
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
                      console.error("❌ Remote video error:", e);
                    }}
                    onLoadStart={() => {
                      console.log("📺 Remote video loading started");
                    }}
                    onCanPlay={() => {
                      console.log("📺 Remote video can play");
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center space-y-4">
                    <UserAvatar username={otherUser.username} size="large" />
                    <div className="text-center">
                      <h3 className="text-white text-xl font-medium">
                        {otherUser.username}
                      </h3>
                      <p className="text-gray-400">
                        {hasRemoteAudio ? "Camera is off" : "Connecting..."}
                      </p>
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
                    style={{ transform: "scaleX(-1)" }} // Mirror local video
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <UserAvatar username="You" size="small" />
                      <p className="text-gray-400 text-xs mt-2">
                        {isVideoOff ? "Camera off" : "No camera"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {callType === "audio" && (
            <>
              {/* Hidden video element for audio */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false} // CRITICAL: Not muted for audio calls
                className="hidden"
              />
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="mb-4">
                    <UserAvatar username={otherUser.username} size="large" />
                  </div>
                  <h3 className="text-white text-xl font-medium mb-2">
                    {otherUser.username}
                  </h3>
                  <p className="text-gray-300">
                    {formatDuration(callDuration)}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    {hasRemoteAudio
                      ? "Voice Call Active"
                      : "Connecting audio..."}
                  </p>
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
                isMuted
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-gray-600 hover:bg-gray-700"
              }`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <MicOff className="w-6 h-6 text-white" />
              ) : (
                <Mic className="w-6 h-6 text-white" />
              )}
            </button>

            {callType === "video" && (
              <button
                onClick={toggleVideo}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  isVideoOff
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-gray-600 hover:bg-gray-700"
                }`}
                title={isVideoOff ? "Turn on camera" : "Turn off camera"}
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
                isRemoteAudioMuted
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-gray-600 hover:bg-gray-700"
              }`}
              title={isRemoteAudioMuted ? "Unmute speaker" : "Mute speaker"}
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
        </div>
      </div>
    </div>
  );
};

export default CallInterface;
