export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private onRemoteStream: ((stream: MediaStream) => void) | null = null;
  private onIceCandidate: ((candidate: RTCIceCandidate) => void) | null = null;
  
  private configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };
  
  async initializePeerConnection(): Promise<void> {
    try {
      this.peerConnection = new RTCPeerConnection(this.configuration);
      
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.onIceCandidate) {
          console.log('🧊 ICE candidate generated');
          this.onIceCandidate(event.candidate);
        }
      };
      
      this.peerConnection.ontrack = (event) => {
        console.log('🎵 Remote track received:', event.track.kind);
        if (this.onRemoteStream && event.streams[0]) {
          // Ensure audio tracks are enabled
          event.streams[0].getAudioTracks().forEach(track => {
            track.enabled = true;
            console.log('🔊 Remote audio track enabled:', track.label);
          });
          this.onRemoteStream(event.streams[0]);
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        console.log('🔗 Connection state:', this.peerConnection?.connectionState);
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', this.peerConnection?.iceConnectionState);
      };
      
      console.log('✅ Peer connection initialized');
    } catch (error) {
      console.error('❌ Failed to initialize peer connection:', error);
      throw error;
    }
  }
  
  async getLocalStream(video: boolean = true): Promise<MediaStream> {
    try {
      console.log(`🎥 Requesting media - Video: ${video}, Audio: true`);
      
      // Stop existing stream if constraints changed
      if (this.localStream) {
        const hasVideo = this.localStream.getVideoTracks().length > 0;
        if (video !== hasVideo) {
          this.localStream.getTracks().forEach(track => track.stop());
          this.localStream = null;
        } else {
          console.log('♻️ Reusing existing stream');
          return this.localStream;
        }
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Ensure audio tracks are enabled
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = true;
        console.log('🎤 Local audio track enabled:', track.label);
      });
      
      console.log('✅ Media stream obtained');
      return this.localStream;
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Camera/microphone access denied. Please allow permissions and try again.');
        } else if (error.name === 'NotFoundError') {
          throw new Error('No camera or microphone found. Please check your devices.');
        } else if (error.name === 'NotReadableError') {
          throw new Error('Camera/microphone is already in use by another application.');
        }
      }
      
      throw new Error('Failed to access camera/microphone. Please check your permissions.');
    }
  }
  
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    try {
      console.log('📞 Creating offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('✅ Offer created and set');
      return offer;
    } catch (error) {
      console.error('❌ Error creating offer:', error);
      throw error;
    }
  }
  
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    try {
      console.log('📱 Creating answer...');
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('✅ Answer created and set');
      return answer;
    } catch (error) {
      console.error('❌ Error creating answer:', error);
      throw error;
    }
  }
  
  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    try {
      console.log('🔄 Setting remote description:', description.type);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(description));
      console.log('✅ Remote description set');
    } catch (error) {
      console.error('❌ Error setting remote description:', error);
      throw error;
    }
  }
  
  async addIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added');
    } catch (error) {
      console.error('⚠️ Error adding ICE candidate:', error);
      // Don't throw - ICE candidates can fail normally
    }
  }
  
  addLocalStream(stream: MediaStream): void {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    try {
      console.log('➕ Adding local stream tracks');
      stream.getTracks().forEach(track => {
        console.log(`📡 Adding ${track.kind} track:`, track.label);
        this.peerConnection!.addTrack(track, stream);
      });
      console.log('✅ Local stream added');
    } catch (error) {
      console.error('❌ Error adding local stream:', error);
      throw error;
    }
  }
  
  setOnRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStream = callback;
  }
  
  setOnIceCandidate(callback: (candidate: RTCIceCandidate) => void): void {
    this.onIceCandidate = callback;
  }
  
  hangup(): void {
    console.log('📴 Hanging up...');
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`🛑 Stopped ${track.kind} track`);
      });
      this.localStream = null;
    }
    
    this.onRemoteStream = null;
    this.onIceCandidate = null;
    console.log('✅ Cleanup complete');
  }

  static async checkMediaDevices(): Promise<{ hasAudio: boolean; hasVideo: boolean }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudio = devices.some(device => device.kind === 'audioinput');
      const hasVideo = devices.some(device => device.kind === 'videoinput');
      
      console.log('🎛️ Available devices - Audio:', hasAudio, 'Video:', hasVideo);
      return { hasAudio, hasVideo };
    } catch (error) {
      console.error('❌ Error checking devices:', error);
      return { hasAudio: false, hasVideo: false };
    }
  }
}