export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onIceCandidateCallback:
    | ((candidate: RTCIceCandidate) => void)
    | null = null;

  constructor() {}

  public async initializePeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
      ],
    });

    // Create a new remote stream for this connection
    this.remoteStream = new MediaStream();

    // Handle remote stream via ontrack
    this.peerConnection.ontrack = (event) => {
      console.log("🎵 ontrack event triggered:", {
        kind: event.track.kind,
        label: event.track.label,
        enabled: event.track.enabled,
        readyState: event.track.readyState,
        streams: event.streams.length
      });
      
      if (this.remoteStream) {
        // Check if track is already added to avoid duplicates
        const existingTrack = this.remoteStream.getTracks().find(
          track => track.id === event.track.id
        );
        
        if (!existingTrack) {
          this.remoteStream.addTrack(event.track);
          console.log("📡 Added remote track:", {
            kind: event.track.kind,
            id: event.track.id,
            totalTracks: this.remoteStream.getTracks().length,
            videoTracks: this.remoteStream.getVideoTracks().length,
            audioTracks: this.remoteStream.getAudioTracks().length
          });
        } else {
          console.log("⚠️ Track already exists, skipping:", event.track.kind);
        }
        
        // Notify callback with the updated stream
        if (this.onRemoteStreamCallback) {
          console.log("🔄 Calling remote stream callback with tracks:", {
            video: this.remoteStream.getVideoTracks().length,
            audio: this.remoteStream.getAudioTracks().length
          });
          this.onRemoteStreamCallback(this.remoteStream);
        }
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidateCallback) {
        console.log("🧊 ICE candidate generated");
        this.onIceCandidateCallback(event.candidate);
      }
    };
    
    this.peerConnection.onconnectionstatechange = () => {
      console.log("🔗 Connection state:", this.peerConnection?.connectionState);
    };
    
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log("🧊 ICE connection state:", this.peerConnection?.iceConnectionState);
    };

    this.peerConnection.onsignalingstatechange = () => {
      console.log("📡 Signaling state:", this.peerConnection?.signalingState);
    };
  }

  public async getLocalStream(withVideo = true): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: withVideo ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      } : false,
    };
    
    console.log("🎥 Requesting media with constraints:", constraints);
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    console.log("✅ Local stream obtained:", {
      videoTracks: this.localStream.getVideoTracks().length,
      audioTracks: this.localStream.getAudioTracks().length,
      videoTrackSettings: this.localStream.getVideoTracks().map(t => ({
        label: t.label,
        enabled: t.enabled,
        settings: t.getSettings()
      }))
    });
    
    return this.localStream;
  }

  public addLocalStream(stream: MediaStream) {
    if (!this.peerConnection) return;
    this.localStream = stream;

    console.log("📡 Adding local stream tracks to peer connection:", {
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    });

    stream.getTracks().forEach((track) => {
      const sender = this.peerConnection!.addTrack(track, stream);
      console.log("📡 Added local track:", {
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState,
        sender: sender ? 'added' : 'failed'
      });
    });

    // Log current senders
    const senders = this.peerConnection.getSenders();
    console.log("📤 Current senders:", senders.map(s => ({
      track: s.track ? {
        kind: s.track.kind,
        enabled: s.track.enabled
      } : null
    })));
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection)
      throw new Error("Peer connection not initialized");

    console.log("📞 Creating offer...");
    const offer = await this.peerConnection.createOffer();
    console.log("📞 Offer created:", {
      type: offer.type,
      hasVideo: offer.sdp?.includes('m=video'),
      hasAudio: offer.sdp?.includes('m=audio')
    });
    
    await this.peerConnection.setLocalDescription(offer);
    console.log("📞 Local description set for offer");
    return offer;
  }

  public async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection)
      throw new Error("Peer connection not initialized");

    console.log("📞 Creating answer...");
    const answer = await this.peerConnection.createAnswer();
    console.log("📞 Answer created:", {
      type: answer.type,
      hasVideo: answer.sdp?.includes('m=video'),
      hasAudio: answer.sdp?.includes('m=audio')
    });
    
    await this.peerConnection.setLocalDescription(answer);
    console.log("📞 Local description set for answer");
    return answer;
  }

  public async setRemoteDescription(
    desc: RTCSessionDescriptionInit
  ): Promise<void> {
    if (!this.peerConnection)
      throw new Error("Peer connection not initialized");

    console.log("📞 Setting remote description:", {
      type: desc.type,
      hasVideo: desc.sdp?.includes('m=video'),
      hasAudio: desc.sdp?.includes('m=audio')
    });
    
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(desc)
    );
    console.log("📞 Remote description set successfully");
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      console.log("⚠️ No peer connection for ICE candidate");
      return;
    }
    
    console.log("🧊 Adding ICE candidate:", candidate.candidate);
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  public hangup() {
    console.log("📴 Hanging up WebRTC connection");
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }
  }

  public setOnRemoteStream(callback: (stream: MediaStream) => void) {
    console.log("🔄 Setting remote stream callback");
    this.onRemoteStreamCallback = callback;
  }

  public setOnIceCandidate(callback: (candidate: RTCIceCandidate) => void) {
    this.onIceCandidateCallback = callback;
  }

  public static async checkMediaDevices(): Promise<{
    hasAudio: boolean;
    hasVideo: boolean;
  }> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasAudio = devices.some((d) => d.kind === "audioinput");
    const hasVideo = devices.some((d) => d.kind === "videoinput");
    
    console.log("🎛️ Media devices check:", {
      hasAudio,
      hasVideo,
      devices: devices.map(d => ({ kind: d.kind, label: d.label }))
    });
    
    return { hasAudio, hasVideo };
  }
}
