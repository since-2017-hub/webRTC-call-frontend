export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private onRemoteStream: ((stream: MediaStream) => void) | null = null;
  private onIceCandidate: ((candidate: RTCIceCandidate) => void) | null = null;
  
  private configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
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
        console.log('🎵 Remote track received:', event.track.kind, 'enabled:', event.track.enabled);
        if (this.onRemoteStream && event.streams[0]) {
          const stream = event.streams[0];
          
          // Ensure all tracks are enabled
          stream.getTracks().forEach(track => {
            track.enabled = true;
            console.log(`🔊 Remote ${track.kind} track enabled:`, track.label);
          });
          
          this.onRemoteStream(stream);
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        console.log('🔗 Connection state:', this.peerConnection?.connectionState);
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', this.peerConnection?.iceConnectionState);
      };

      this.peerConnection.onsignalingstatechange = () => {
        console.log('📡 Signaling state:', this.peerConnection?.signalingState);
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
      
      // Always stop existing stream to get fresh permissions
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      // Request permissions first
      await this.requestPermissions(video);

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        },
        video: video ? {
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          frameRate: { min: 15, ideal: 30, max: 60 },
          facingMode: 'user'
        } : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Verify and enable all tracks
      this.localStream.getTracks().forEach(track => {
        track.enabled = true;
        console.log(`🎤 Local ${track.kind} track enabled:`, track.label, 'ready state:', track.readyState);
      });
      
      console.log('✅ Media stream obtained successfully');
      console.log('📊 Stream details:', {
        audioTracks: this.localStream.getAudioTracks().length,
        videoTracks: this.localStream.getVideoTracks().length,
        active: this.localStream.active
      });
      
      return this.localStream;
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Camera/microphone access denied. Please allow permissions in your browser settings and refresh the page.');
        } else if (error.name === 'NotFoundError') {
          if (video) {
            console.log('📷 No camera found, trying audio-only');
            try {
              return await this.getLocalStream(false);
            } catch (audioError) {
              throw new Error('No camera or microphone found. Please check your devices.');
            }
          }
          throw new Error('No microphone found. Please check your devices.');
        } else if (error.name === 'NotReadableError') {
          throw new Error('Camera/microphone is already in use by another application. Please close other apps and try again.');
        } else if (error.name === 'OverconstrainedError') {
          console.log('📷 Camera constraints too strict, trying with basic settings');
          try {
            const basicConstraints: MediaStreamConstraints = {
              audio: true,
              video: video ? true : false
            };
            this.localStream = await navigator.mediaDevices.getUserMedia(basicConstraints);
            return this.localStream;
          } catch (basicError) {
            throw new Error('Camera/microphone constraints not supported by your device.');
          }
        }
      }
      
      throw new Error('Failed to access camera/microphone. Please check your permissions and try again.');
    }
  }

  private async requestPermissions(video: boolean): Promise<void> {
    try {
      // Check if permissions are already granted
      const audioPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      const videoPermission = video ? await navigator.permissions.query({ name: 'camera' as PermissionName }) : null;
      
      console.log('🔐 Permissions - Audio:', audioPermission.state, video ? 'Video:' : '', videoPermission?.state || 'N/A');
      
      if (audioPermission.state === 'denied' || (video && videoPermission?.state === 'denied')) {
        throw new Error('Permissions denied. Please enable camera/microphone access in your browser settings.');
      }
    } catch (error) {
      console.log('⚠️ Permission check failed, will try direct access:', error);
      // Continue anyway - some browsers don't support permissions API
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
      console.log('✅ Offer created and set as local description');
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
      const answer = await this.peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await this.peerConnection.setLocalDescription(answer);
      console.log('✅ Answer created and set as local description');
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
      console.log('✅ Remote description set successfully');
    } catch (error) {
      console.error('❌ Error setting remote description:', error);
      throw error;
    }
  }
  
  async addIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.peerConnection) {
      console.log('⚠️ Cannot add ICE candidate: peer connection not initialized');
      return;
    }

    if (this.peerConnection.remoteDescription === null) {
      console.log('⚠️ Cannot add ICE candidate: remote description not set yet');
      return;
    }
    
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added successfully');
    } catch (error) {
      console.error('⚠️ Error adding ICE candidate (non-fatal):', error);
      // Don't throw - ICE candidates can fail normally during connection establishment
    }
  }
  
  addLocalStream(stream: MediaStream): void {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    try {
      console.log('➕ Adding local stream tracks to peer connection');
      
      // Remove existing tracks first
      this.peerConnection.getSenders().forEach(sender => {
        if (sender.track) {
          this.peerConnection!.removeTrack(sender);
        }
      });
      
      // Add new tracks
      stream.getTracks().forEach(track => {
        console.log(`📡 Adding ${track.kind} track:`, track.label, 'enabled:', track.enabled);
        this.peerConnection!.addTrack(track, stream);
      });
      
      console.log('✅ Local stream tracks added successfully');
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
    console.log('📴 Hanging up and cleaning up resources...');
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`🛑 Stopped ${track.kind} track:`, track.label);
      });
      this.localStream = null;
    }
    
    this.onRemoteStream = null;
    this.onIceCandidate = null;
    console.log('✅ Cleanup completed');
  }

  static async checkMediaDevices(): Promise<{ hasAudio: boolean; hasVideo: boolean }> {
    try {
      // First check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ getUserMedia not supported');
        return { hasAudio: false, hasVideo: false };
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudio = devices.some(device => device.kind === 'audioinput' && device.deviceId !== 'default');
      const hasVideo = devices.some(device => device.kind === 'videoinput' && device.deviceId !== 'default');
      
      console.log('🎛️ Available devices:', {
        total: devices.length,
        audio: hasAudio,
        video: hasVideo,
        devices: devices.map(d => ({ kind: d.kind, label: d.label || 'Unknown' }))
      });
      
      return { hasAudio, hasVideo };
    } catch (error) {
      console.error('❌ Error checking media devices:', error);
      return { hasAudio: false, hasVideo: false };
    }
  }

  // Test media access without creating a stream
  static async testMediaAccess(): Promise<{ audio: boolean; video: boolean }> {
    const results = { audio: false, video: false };
    
    try {
      // Test audio access
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      results.audio = true;
      audioStream.getTracks().forEach(track => track.stop());
      console.log('✅ Audio access test passed');
    } catch (error) {
      console.log('❌ Audio access test failed:', error);
    }
    
    try {
      // Test video access
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      results.video = true;
      videoStream.getTracks().forEach(track => track.stop());
      console.log('✅ Video access test passed');
    } catch (error) {
      console.log('❌ Video access test failed:', error);
    }
    
    return results;
  }
}