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
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
  };
  
  async initializePeerConnection(): Promise<void> {
    try {
      this.peerConnection = new RTCPeerConnection(this.configuration);
      
      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.onIceCandidate) {
          console.log('🧊 Sending ICE candidate:', event.candidate.type);
          this.onIceCandidate(event.candidate);
        }
      };
      
      // Handle remote stream - CRITICAL for audio/video
      this.peerConnection.ontrack = (event) => {
        console.log('🎵 Remote track received:', {
          kind: event.track.kind,
          enabled: event.track.enabled,
          readyState: event.track.readyState,
          streamId: event.streams[0]?.id
        });
        
        if (this.onRemoteStream && event.streams[0]) {
          const stream = event.streams[0];
          
          // Force enable all tracks
          stream.getTracks().forEach(track => {
            track.enabled = true;
            console.log(`✅ Remote ${track.kind} track enabled:`, track.label || 'unlabeled');
          });
          
          // Call the callback immediately
          this.onRemoteStream(stream);
        }
      };

      // Connection state monitoring
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        console.log('🔗 Connection state changed:', state);
        
        if (state === 'connected') {
          console.log('✅ WebRTC connection established successfully');
        } else if (state === 'failed' || state === 'disconnected') {
          console.log('❌ WebRTC connection failed or disconnected');
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection?.iceConnectionState;
        console.log('🧊 ICE connection state:', state);
      };

      this.peerConnection.onsignalingstatechange = () => {
        console.log('📡 Signaling state:', this.peerConnection?.signalingState);
      };
      
      console.log('✅ Peer connection initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize peer connection:', error);
      throw error;
    }
  }
  
  async getLocalStream(video: boolean = true): Promise<MediaStream> {
    try {
      console.log(`🎥 Requesting media stream - Video: ${video}, Audio: true`);
      
      // Stop existing stream first
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          track.stop();
          console.log(`🛑 Stopped existing ${track.kind} track`);
        });
        this.localStream = null;
      }

      // Define media constraints
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 2
        },
        video: video ? {
          width: { min: 320, ideal: 640, max: 1280 },
          height: { min: 240, ideal: 480, max: 720 },
          frameRate: { min: 15, ideal: 30, max: 60 },
          facingMode: 'user'
        } : false
      };

      console.log('📋 Media constraints:', constraints);

      // Request media stream
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Verify stream quality
      const audioTracks = this.localStream.getAudioTracks();
      const videoTracks = this.localStream.getVideoTracks();
      
      console.log('📊 Stream obtained:', {
        audioTracks: audioTracks.length,
        videoTracks: videoTracks.length,
        streamActive: this.localStream.active,
        streamId: this.localStream.id
      });
      
      // Enable and verify all tracks
      this.localStream.getTracks().forEach(track => {
        track.enabled = true;
        console.log(`✅ ${track.kind} track:`, {
          label: track.label || 'unlabeled',
          enabled: track.enabled,
          readyState: track.readyState,
          settings: track.getSettings()
        });
      });
      
      return this.localStream;
    } catch (error) {
      console.error('❌ Error getting media stream:', error);
      
      if (error instanceof Error) {
        switch (error.name) {
          case 'NotAllowedError':
            throw new Error('Camera/microphone access denied. Please allow permissions and refresh.');
          case 'NotFoundError':
            if (video) {
              console.log('📷 Camera not found, trying audio-only');
              return await this.getLocalStream(false);
            }
            throw new Error('No microphone found. Please connect a microphone.');
          case 'NotReadableError':
            throw new Error('Camera/microphone is being used by another application.');
          case 'OverconstrainedError':
            console.log('📷 Constraints too strict, trying basic settings');
            try {
              const basicConstraints: MediaStreamConstraints = {
                audio: true,
                video: video ? true : false
              };
              this.localStream = await navigator.mediaDevices.getUserMedia(basicConstraints);
              return this.localStream;
            } catch (basicError) {
              throw new Error('Your device does not support the required media settings.');
            }
          default:
            throw new Error(`Media access error: ${error.message}`);
        }
      }
      
      throw new Error('Failed to access camera/microphone. Please check permissions.');
    }
  }
  
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    try {
      console.log('📞 Creating WebRTC offer...');
      
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: false
      });
      
      console.log('📋 Offer created:', {
        type: offer.type,
        sdpLength: offer.sdp?.length || 0
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('✅ Local description set successfully');
      
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
      console.log('📱 Creating WebRTC answer...');
      
      const answer = await this.peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      console.log('📋 Answer created:', {
        type: answer.type,
        sdpLength: answer.sdp?.length || 0
      });
      
      await this.peerConnection.setLocalDescription(answer);
      console.log('✅ Local description set for answer');
      
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
      console.log('🔄 Setting remote description:', {
        type: description.type,
        sdpLength: description.sdp?.length || 0
      });
      
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
      console.log('⚠️ Cannot add ICE candidate: remote description not set');
      return;
    }
    
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added:', candidate.type);
    } catch (error) {
      console.error('⚠️ Error adding ICE candidate:', error);
      // Don't throw - ICE candidates can fail during normal operation
    }
  }
  
  addLocalStream(stream: MediaStream): void {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    try {
      console.log('➕ Adding local stream to peer connection');
      
      // Remove existing senders first
      const senders = this.peerConnection.getSenders();
      senders.forEach(sender => {
        if (sender.track) {
          console.log(`🗑️ Removing existing ${sender.track.kind} sender`);
          this.peerConnection!.removeTrack(sender);
        }
      });
      
      // Add all tracks from the stream
      stream.getTracks().forEach(track => {
        console.log(`📡 Adding ${track.kind} track to peer connection:`, {
          label: track.label || 'unlabeled',
          enabled: track.enabled,
          readyState: track.readyState
        });
        
        const sender = this.peerConnection!.addTrack(track, stream);
        console.log(`✅ Track sender added for ${track.kind}`);
      });
      
      console.log('✅ All local stream tracks added successfully');
    } catch (error) {
      console.error('❌ Error adding local stream:', error);
      throw error;
    }
  }
  
  setOnRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStream = callback;
    console.log('📝 Remote stream callback set');
  }
  
  setOnIceCandidate(callback: (candidate: RTCIceCandidate) => void): void {
    this.onIceCandidate = callback;
    console.log('📝 ICE candidate callback set');
  }
  
  hangup(): void {
    console.log('📴 Hanging up and cleaning up resources...');
    
    if (this.peerConnection) {
      // Close peer connection
      this.peerConnection.close();
      this.peerConnection = null;
      console.log('🔌 Peer connection closed');
    }
    
    if (this.localStream) {
      // Stop all tracks
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`🛑 Stopped ${track.kind} track:`, track.label || 'unlabeled');
      });
      this.localStream = null;
    }
    
    // Clear callbacks
    this.onRemoteStream = null;
    this.onIceCandidate = null;
    
    console.log('✅ Cleanup completed successfully');
  }

  // Utility methods
  static async checkMediaDevices(): Promise<{ hasAudio: boolean; hasVideo: boolean }> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.error('❌ Media devices API not supported');
        return { hasAudio: false, hasVideo: false };
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudio = devices.some(device => device.kind === 'audioinput');
      const hasVideo = devices.some(device => device.kind === 'videoinput');
      
      console.log('🎛️ Media devices found:', {
        total: devices.length,
        audio: hasAudio,
        video: hasVideo,
        devices: devices.map(d => ({ 
          kind: d.kind, 
          label: d.label || 'Unknown Device',
          deviceId: d.deviceId ? 'present' : 'missing'
        }))
      });
      
      return { hasAudio, hasVideo };
    } catch (error) {
      console.error('❌ Error checking media devices:', error);
      return { hasAudio: false, hasVideo: false };
    }
  }

  static async testMediaAccess(): Promise<{ audio: boolean; video: boolean }> {
    const results = { audio: false, video: false };
    
    // Test audio access
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true 
        } 
      });
      results.audio = true;
      audioStream.getTracks().forEach(track => track.stop());
      console.log('✅ Audio access test passed');
    } catch (error) {
      console.log('❌ Audio access test failed:', error);
    }
    
    // Test video access
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480 
        } 
      });
      results.video = true;
      videoStream.getTracks().forEach(track => track.stop());
      console.log('✅ Video access test passed');
    } catch (error) {
      console.log('❌ Video access test failed:', error);
    }
    
    return results;
  }

  // Get current stream info
  getStreamInfo(): { local: any; remote: any } {
    const localInfo = this.localStream ? {
      id: this.localStream.id,
      active: this.localStream.active,
      audioTracks: this.localStream.getAudioTracks().length,
      videoTracks: this.localStream.getVideoTracks().length,
      tracks: this.localStream.getTracks().map(track => ({
        kind: track.kind,
        enabled: track.enabled,
        readyState: track.readyState,
        label: track.label
      }))
    } : null;

    return {
      local: localInfo,
      remote: 'Remote stream handled by callback'
    };
  }
}