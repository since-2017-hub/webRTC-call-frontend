export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private onRemoteStream: ((stream: MediaStream) => void) | null = null;
  private onIceCandidate: ((candidate: RTCIceCandidate) => void) | null = null;
  
  private configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ],
  };
  
  async initializePeerConnection(): Promise<void> {
    try {
      console.log('🔄 Initializing peer connection...');
      this.peerConnection = new RTCPeerConnection(this.configuration);
      
      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.onIceCandidate) {
          console.log('🧊 New ICE candidate:', event.candidate.type);
          this.onIceCandidate(event.candidate);
        }
      };
      
      // Handle remote stream - CRITICAL for receiving audio/video
      this.peerConnection.ontrack = (event) => {
        console.log('🎵 Remote track received:', {
          kind: event.track.kind,
          enabled: event.track.enabled,
          readyState: event.track.readyState,
          streamCount: event.streams.length
        });
        
        if (event.streams && event.streams[0]) {
          const remoteStream = event.streams[0];
          console.log('📺 Remote stream details:', {
            id: remoteStream.id,
            active: remoteStream.active,
            audioTracks: remoteStream.getAudioTracks().length,
            videoTracks: remoteStream.getVideoTracks().length
          });
          
          // Ensure all tracks are enabled
          remoteStream.getTracks().forEach(track => {
            track.enabled = true;
            console.log(`✅ Enabled remote ${track.kind} track:`, track.label);
          });
          
          if (this.onRemoteStream) {
            this.onRemoteStream(remoteStream);
          }
        }
      };

      // Connection state monitoring
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
      
      // Stop existing stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      // Try with optimal settings first
      let constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: video ? {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        } : false
      };

      try {
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        console.warn('⚠️ Optimal constraints failed, trying basic:', error);
        // Fallback to basic constraints
        constraints = {
          audio: true,
          video: video ? true : false
        };
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      }
      
      console.log('✅ Local stream obtained:', {
        id: this.localStream.id,
        active: this.localStream.active,
        audioTracks: this.localStream.getAudioTracks().length,
        videoTracks: this.localStream.getVideoTracks().length
      });
      
      // Verify tracks are enabled
      this.localStream.getTracks().forEach(track => {
        track.enabled = true;
        console.log(`✅ Local ${track.kind} track enabled:`, {
          label: track.label,
          enabled: track.enabled,
          readyState: track.readyState
        });
      });
      
      return this.localStream;
    } catch (error) {
      console.error('❌ Error getting media stream:', error);
      throw new Error(`Failed to access ${video ? 'camera/microphone' : 'microphone'}. Please check permissions.`);
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
      console.log('✅ Offer created and local description set');
      
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
      console.log('✅ Answer created and local description set');
      
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
      console.warn('⚠️ Cannot add ICE candidate: peer connection not initialized');
      return;
    }

    if (!this.peerConnection.remoteDescription) {
      console.warn('⚠️ Cannot add ICE candidate: remote description not set');
      return;
    }
    
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added successfully');
    } catch (error) {
      console.warn('⚠️ Error adding ICE candidate:', error);
    }
  }
  
  addLocalStream(stream: MediaStream): void {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    try {
      console.log('➕ Adding local stream to peer connection');
      
      // Remove existing senders
      this.peerConnection.getSenders().forEach(sender => {
        if (sender.track) {
          this.peerConnection!.removeTrack(sender);
        }
      });
      
      // Add all tracks
      stream.getTracks().forEach(track => {
        console.log(`📡 Adding ${track.kind} track:`, {
          label: track.label,
          enabled: track.enabled,
          readyState: track.readyState
        });
        this.peerConnection!.addTrack(track, stream);
      });
      
      console.log('✅ Local stream added successfully');
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
    
    console.log('✅ Cleanup completed');
  }
}