import React, { useEffect, useRef, useState } from "react";
import { PhoneOff, Mic, MicOff, Video, VideoOff, User } from "lucide-react";
import { User as UserType } from "../services/api";

interface CallInterfaceProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  hasVideo: boolean;
  callType: "audio" | "video";
  otherUser: UserType;
  onEndCall: () => void;
}

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

const UserAvatar: React.FC<{ username: string; size?: "small" | "large" }> = ({
  username,
  size = "large",
}) => {
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

const CallInterface: React.FC<CallInterfaceProps> = ({
  localStream,
  remoteStream,
  callType,
  otherUser,
  onEndCall,
  hasVideo,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState({
    local: false,
    remote: false,
  });

  // Set up local video/audio
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      console.log("📹 Local video stream set");

      // Check local audio tracks
      const audioTracks = localStream.getAudioTracks();
      console.log(
        "🎤 Local audio tracks:",
        audioTracks.length,
        audioTracks.map((t) => ({ label: t.label, enabled: t.enabled }))
      );
    }
  }, [localStream]);

  // Set up remote video/audio - CRITICAL FIX
  useEffect(() => {
    if (remoteStream) {
      // Set up remote video element
      const videoTracks = remoteStream.getVideoTracks();

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.volume = 1.0;
        remoteVideoRef.current.muted = false; // CRITICAL: Not muted so we can hear them
        remoteVideoRef.current.autoplay = true;
        remoteVideoRef.current.playsInline = true;

        // Force play
        remoteVideoRef.current.play().catch((error) => {
          console.error("❌ Error playing remote video:", error);
        });
      }
      console.log(remoteStream, videoTracks, "removet Video tracks");
      console.log(localStream, remoteVideoRef, "removet Video tracks");
      // Set up dedicated audio element for better audio handling
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.volume = 1.0;
        remoteAudioRef.current.muted = false; // CRITICAL: Not muted for audio
        remoteAudioRef.current.autoplay = true;

        // Force play audio
        remoteAudioRef.current
          .play()
          .then(() => {
            console.log("🔊 Remote audio playing successfully");
          })
          .catch((error) => {
            console.error("❌ Error playing remote audio:", error);
            // Try to play with user interaction
            document.addEventListener(
              "click",
              () => {
                remoteAudioRef.current?.play();
              },
              { once: true }
            );
          });
      }

      // Log remote audio tracks
      const audioTracks = remoteStream.getAudioTracks();
      console.log(
        "🎵 Remote audio tracks:",
        audioTracks.length,
        audioTracks.map((t) => ({ label: t.label, enabled: t.enabled }))
      );

      // Ensure all remote audio tracks are enabled
      audioTracks.forEach((track, index) => {
        track.enabled = true;
        console.log(`🔊 Remote audio track ${index} enabled:`, track.enabled);
      });
    }
  }, [remoteStream, callType]);

  // Call duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Monitor audio levels
  useEffect(() => {
    const interval = setInterval(() => {
      if (localStream) {
        const localAudio = localStream
          .getAudioTracks()
          .some((track) => track.enabled);
        const remoteAudio =
          remoteStream?.getAudioTracks().some((track) => track.enabled) ||
          false;
        setAudioLevels({ local: localAudio, remote: remoteAudio });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [localStream, remoteStream]);

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
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-gray-900 z-50">
      {/* Hidden audio element for remote audio - CRITICAL */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        muted={false}
        style={{ display: "none" }}
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
              <p className="text-gray-300 text-sm">
                {formatDuration(callDuration)}
              </p>
            </div>
          </div>
          <div className="text-white text-sm flex items-center space-x-4">
            <span>{callType === "video" ? "Video Call" : "Voice Call"}</span>
            {/* Audio status indicators */}
            <div className="flex items-center space-x-2 text-xs">
              <span
                className={`${
                  audioLevels.local ? "text-green-400" : "text-red-400"
                }`}
              >
                🎤 {audioLevels.local ? "ON" : "OFF"}
              </span>
              <span
                className={`${
                  audioLevels.remote ? "text-green-400" : "text-red-400"
                }`}
              >
                🔊 {audioLevels.remote ? "RECV" : "NO AUDIO"}
              </span>
            </div>
          </div>
        </div>

        {/* Video/Audio Area */}
        <div className="flex-1 relative">
          {callType === "video" && (
            <>
              {/* Remote Video (Main) */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false} // CRITICAL: Not muted so we can hear them
                className="w-1/2 h-1/2 object-cover bg-gray-800"
                style={{ minHeight: "300px" }}
              />

              {/* Local Video (Picture-in-Picture) */}
              <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                {!hasVideo || isVideoOff ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <UserAvatar username="You" size="small" />
                      <p className="text-gray-400 text-xs mt-2">
                        {isVideoOff ? "Camera off" : "No camera"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted={true} // CRITICAL: Muted to prevent audio feedback
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </>
          )}

          {callType === "audio" && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-32 h-32 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-16 h-16 text-white" />
                </div>
                <h3 className="text-white text-xl font-medium mb-2">
                  {otherUser.username}
                </h3>
                <p className="text-gray-300">{formatDuration(callDuration)}</p>
                <p className="text-gray-400 text-sm mt-2">Voice Call Active</p>
                {/* Audio status for audio calls */}
                <div className="flex items-center justify-center space-x-4 mt-4 text-xs">
                  <span
                    className={`${
                      audioLevels.local ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    🎤 Your Mic: {audioLevels.local ? "ON" : "OFF"}
                  </span>
                  <span
                    className={`${
                      audioLevels.remote ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    🔊 Their Audio:{" "}
                    {audioLevels.remote ? "RECEIVING" : "NO SIGNAL"}
                  </span>
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
