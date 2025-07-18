export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onIceCandidateCallback: ((candidate: RTCIceCandidate) => void) | null = null;

  constructor() {}

  public async initializePeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    // Critical: handle remote stream via ontrack
    this.peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      console.log("🎵 ontrack event triggered");
      this.onRemoteStreamCallback?.(stream);
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidateCallback) {
        this.onIceCandidateCallback(event.candidate);
      }
    };
  }

  public async getLocalStream(withVideo = true): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: withVideo,
    };
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    return this.localStream;
  }

  public addLocalStream(stream: MediaStream) {
    if (!this.peerConnection) return;
    this.localStream = stream;

    stream.getTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, stream);
      console.log("📡 Added local track:", track.kind, track.label);
    });
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error("Peer connection not initialized");

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  public async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error("Peer connection not initialized");

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  public async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) throw new Error("Peer connection not initialized");

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  public hangup() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  public setOnRemoteStream(callback: (stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
  }

  public setOnIceCandidate(callback: (candidate: RTCIceCandidate) => void) {
    this.onIceCandidateCallback = callback;
  }

  public static async checkMediaDevices(): Promise<{ hasAudio: boolean; hasVideo: boolean }> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasAudio = devices.some((d) => d.kind === "audioinput");
    const hasVideo = devices.some((d) => d.kind === "videoinput");
    return { hasAudio, hasVideo };
  }
}
