import React, { useState, useEffect } from 'react';
import { LogOut, Phone, Video, Users, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../services/api';
import socketService from '../services/socket';
import { WebRTCService } from '../services/webrtc';
import UserList from './UserList';
import IncomingCall from './IncomingCall';
import CallInterface from './CallInterface';

interface CallState {
  id?: string;
  type: 'audio' | 'video';
  otherUser: User;
  status: 'calling' | 'ringing' | 'connected';
}

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [currentCall, setCurrentCall] = useState<CallState | null>(null);
  const [webrtcService] = useState(() => new WebRTCService());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [notification, setNotification] = useState<string | null>(null);
  const [mediaDeviceStatus, setMediaDeviceStatus] = useState<{hasAudio: boolean; hasVideo: boolean} | null>(null);
  
  const showNotification = (message: string) => {
    console.log('📢 Notification:', message);
    setNotification(message);
    setTimeout(() => setNotification(null), 5000);
  };

  // Check media devices and permissions on mount
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        console.log('🎛️ Initializing media devices...');
        
        // Check available devices
        const deviceStatus = await WebRTCService.checkMediaDevices();
        setMediaDeviceStatus(deviceStatus);
        
        // Test actual access
        const accessTest = await WebRTCService.testMediaAccess();
        console.log('🔍 Media access test results:', accessTest);
        
        if (!deviceStatus.hasAudio) {
          showNotification('⚠️ No microphone detected. Voice calls may not work.');
        }
        if (!deviceStatus.hasVideo) {
          showNotification('⚠️ No camera detected. Video calls will show avatar only.');
        }
        
        if (accessTest.audio && accessTest.video) {
          showNotification('✅ Camera and microphone ready');
        } else if (accessTest.audio) {
          showNotification('✅ Microphone ready, camera access needed for video calls');
        } else {
          showNotification('⚠️ Please allow camera/microphone access for calls');
        }
        
      } catch (error) {
        console.error('❌ Error initializing media:', error);
        showNotification('⚠️ Error checking media devices. Please refresh and allow permissions.');
      }
    };

    initializeMedia();
  }, []);
  
  useEffect(() => {
    if (!user) return;
    
    console.log('🔌 Connecting user to socket:', user.username);
    const socket = socketService.connect(user.id, user.username);
    
    socket.on('connect', () => {
      console.log('✅ Socket connected successfully');
      setConnectionStatus('connected');
      showNotification('✅ Connected to server');
    });
    
    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setConnectionStatus('disconnected');
      showNotification('❌ Disconnected from server');
    });
    
    socket.on('join_success', (data) => {
      console.log('🎉 Join success:', data.onlineUsers.length, 'users online');
      setUsers(data.onlineUsers);
      showNotification(`✅ ${data.message} (${data.onlineUsers.length} users online)`);
    });
    
    socket.on('users_updated', (onlineUsers: User[]) => {
      console.log('👥 Users updated:', onlineUsers.length, 'online');
      setUsers(onlineUsers);
    });
    
    socket.on('incoming_call', async (data) => {
      console.log('📞 Incoming call received:', {
        from: data.from.username,
        type: data.callType,
        hasOffer: !!data.offer
      });
      
      setIncomingCall(data);
      showNotification(`📞 Incoming ${data.callType} call from ${data.from.username}`);
      
      try {
        // Initialize WebRTC for incoming call
        await webrtcService.initializePeerConnection();
        
        // Set up remote stream handler BEFORE setting remote description
        webrtcService.setOnRemoteStream((stream) => {
          console.log('🎵 Remote stream received for incoming call:', {
            id: stream.id,
            active: stream.active,
            audioTracks: stream.getAudioTracks().length,
            videoTracks: stream.getVideoTracks().length
          });
          setRemoteStream(stream);
        });
        
        // Set up ICE candidate handler
        webrtcService.setOnIceCandidate((candidate) => {
          console.log('🧊 Sending ICE candidate to caller');
          socket.emit('ice_candidate', {
            to: data.from.id,
            candidate,
          });
        });
        
        // Set remote description from offer
        if (data.offer) {
          await webrtcService.setRemoteDescription(data.offer);
          console.log('✅ Remote description set for incoming call');
        }
        
      } catch (error) {
        console.error('❌ Error handling incoming call:', error);
        showNotification('❌ Error handling incoming call');
      }
    });
    
    socket.on('call_accepted', async (data) => {
      console.log('✅ Call accepted by remote user:', data.callId);
      try {
        if (data.answer) {
          await webrtcService.setRemoteDescription(data.answer);
          console.log('✅ Remote description set from answer');
        }
        
        setCurrentCall(prev => prev ? {
          ...prev,
          id: data.callId,
          status: 'connected'
        } : null);
        
        showNotification('✅ Call connected successfully');
      } catch (error) {
        console.error('❌ Error handling call acceptance:', error);
        showNotification('❌ Error connecting call');
      }
    });
    
    socket.on('call_rejected', () => {
      console.log('❌ Call was rejected by remote user');
      setCurrentCall(null);
      webrtcService.hangup();
      setLocalStream(null);
      setRemoteStream(null);
      showNotification('❌ Call was rejected');
    });
    
    socket.on('call_ended', () => {
      console.log('📴 Call ended by remote user');
      setCurrentCall(null);
      setIncomingCall(null);
      webrtcService.hangup();
      setLocalStream(null);
      setRemoteStream(null);
      showNotification('📴 Call ended');
    });
    
    socket.on('ice_candidate', async (data) => {
      console.log('🧊 ICE candidate received from remote');
      try {
        await webrtcService.addIceCandidate(data.candidate);
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    });
    
    socket.on('call_status', (data) => {
      console.log('📊 Call status update:', data.status);
      if (data.status === 'user_offline') {
        showNotification('❌ User is offline');
        setCurrentCall(null);
      } else if (data.status === 'ringing') {
        setCurrentCall(prev => prev ? { ...prev, status: 'ringing' } : null);
        showNotification('📞 Ringing...');
      }
    });
    
    return () => {
      console.log('🧹 Cleaning up socket listeners');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('join_success');
      socket.off('users_updated');
      socket.off('incoming_call');
      socket.off('call_accepted');
      socket.off('call_rejected');
      socket.off('call_ended');
      socket.off('ice_candidate');
      socket.off('call_status');
    };
  }, [user, webrtcService]);
  
  const handleCall = async (targetUser: User, callType: 'audio' | 'video') => {
    try {
      console.log(`📞 Initiating ${callType} call to:`, targetUser.username);
      
      // Check media device availability
      const { hasAudio, hasVideo } = await WebRTCService.checkMediaDevices();
      
      if (!hasAudio) {
        showNotification('❌ No microphone found. Please connect a microphone and try again.');
        return;
      }
      
      if (callType === 'video' && !hasVideo) {
        showNotification('⚠️ No camera found - proceeding with audio-only call');
      }
      
      // Set call state immediately
      setCurrentCall({
        type: callType,
        otherUser: targetUser,
        status: 'calling'
      });
      
      showNotification(`📞 Calling ${targetUser.username}...`);
      
      // Initialize WebRTC
      await webrtcService.initializePeerConnection();
      
      // Set up remote stream handler BEFORE getting local stream
      webrtcService.setOnRemoteStream((stream) => {
        console.log('🎵 Remote stream received for outgoing call:', {
          id: stream.id,
          active: stream.active,
          audioTracks: stream.getAudioTracks().length,
          videoTracks: stream.getVideoTracks().length
        });
        setRemoteStream(stream);
      });
      
      // Set up ICE candidate handler
      webrtcService.setOnIceCandidate((candidate) => {
        console.log('🧊 Sending ICE candidate to callee');
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('ice_candidate', {
            to: targetUser.id,
            candidate,
          });
        }
      });
      
      // Get local media stream
      let stream: MediaStream;
      try {
        const needsVideo = callType === 'video' && hasVideo;
        console.log(`🎥 Getting local stream - Video: ${needsVideo}, Audio: true`);
        stream = await webrtcService.getLocalStream(needsVideo);
        console.log('✅ Local stream obtained successfully');
      } catch (error) {
        console.error('❌ Failed to get local stream:', error);
        setCurrentCall(null);
        showNotification(`❌ ${error instanceof Error ? error.message : 'Failed to access camera/microphone'}`);
        return;
      }
      
      setLocalStream(stream);
      webrtcService.addLocalStream(stream);
      
      // Create and send offer
      const offer = await webrtcService.createOffer();
      console.log('📋 Offer created, sending to server');
      
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('call_user', {
          to: targetUser.id,
          from: user,
          callType,
          offer,
        });
        console.log('📤 Call request sent to server');
      }
    } catch (error) {
      console.error('❌ Error starting call:', error);
      setCurrentCall(null);
      showNotification(`❌ Failed to start call: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  const handleAcceptCall = async () => {
    try {
      console.log('✅ Accepting incoming call from:', incomingCall.from.username);
      
      const { hasAudio, hasVideo } = await WebRTCService.checkMediaDevices();
      
      if (!hasAudio) {
        showNotification('❌ No microphone found. Cannot accept call.');
        handleRejectCall();
        return;
      }
      
      if (incomingCall.callType === 'video' && !hasVideo) {
        showNotification('⚠️ No camera found - accepting as audio-only call');
      }
      
      // Get local media stream
      let stream: MediaStream;
      try {
        const needsVideo = incomingCall.callType === 'video' && hasVideo;
        console.log(`🎥 Getting local stream for answer - Video: ${needsVideo}, Audio: true`);
        stream = await webrtcService.getLocalStream(needsVideo);
        console.log('✅ Local stream obtained for incoming call');
      } catch (error) {
        console.error('❌ Failed to get local stream for incoming call:', error);
        showNotification(`❌ ${error instanceof Error ? error.message : 'Failed to access camera/microphone'}`);
        handleRejectCall();
        return;
      }
      
      setLocalStream(stream);
      webrtcService.addLocalStream(stream);
      
      // Create answer
      const answer = await webrtcService.createAnswer();
      console.log('📋 Answer created, sending to server');
      
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('accept_call', {
          callId: incomingCall.callId,
          answer,
        });
        console.log('📤 Call acceptance sent to server');
      }
      
      setCurrentCall({
        id: incomingCall.callId,
        type: incomingCall.callType,
        otherUser: incomingCall.from,
        status: 'connected'
      });
      
      setIncomingCall(null);
      showNotification('✅ Call accepted successfully');
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      showNotification(`❌ Failed to accept call: ${error instanceof Error ? error.message : 'Unknown error'}`);
      handleRejectCall();
    }
  };
  
  const handleRejectCall = () => {
    console.log('❌ Rejecting incoming call');
    const socket = socketService.getSocket();
    if (socket && incomingCall) {
      socket.emit('reject_call', {
        callId: incomingCall.callId,
      });
    }
    
    setIncomingCall(null);
    webrtcService.hangup();
    showNotification('❌ Call rejected');
  };
  
  const handleEndCall = () => {
    console.log('📴 Ending current call');
    const socket = socketService.getSocket();
    if (socket && currentCall?.id) {
      socket.emit('end_call', {
        callId: currentCall.id,
      });
    }
    
    setCurrentCall(null);
    setIncomingCall(null);
    webrtcService.hangup();
    setLocalStream(null);
    setRemoteStream(null);
    showNotification('📴 Call ended');
  };
  
  const handleLogout = () => {
    console.log('👋 User logging out');
    webrtcService.hangup();
    socketService.disconnect();
    logout();
  };
  
  if (!user) return null;
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in max-w-sm">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <span className="text-sm">{notification}</span>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 rounded-full p-2">
                <Video className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">Video Call App</h1>
                <div className="flex items-center space-x-4">
                  <p className="text-sm text-gray-600">Welcome, {user.username}</p>
                  <div className="flex items-center space-x-1">
                    {connectionStatus === 'connected' ? (
                      <Wifi className="w-4 h-4 text-green-500" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`text-xs ${connectionStatus === 'connected' ? 'text-green-500' : 'text-red-500'}`}>
                      {connectionStatus}
                    </span>
                  </div>
                  {mediaDeviceStatus && (
                    <div className="flex items-center space-x-2 text-xs">
                      <span className={`px-2 py-1 rounded ${mediaDeviceStatus.hasAudio ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        🎤 {mediaDeviceStatus.hasAudio ? 'Ready' : 'None'}
                      </span>
                      <span className={`px-2 py-1 rounded ${mediaDeviceStatus.hasVideo ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        📹 {mediaDeviceStatus.hasVideo ? 'Ready' : 'None'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <UserList
              users={users}
              currentUser={user}
              onCall={handleCall}
            />
          </div>
          
          <div className="space-y-6">
            {/* Connection Status */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                System Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Connection</span>
                  <div className="flex items-center space-x-2">
                    {connectionStatus === 'connected' ? (
                      <Wifi className="w-4 h-4 text-green-500" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${connectionStatus === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                      {connectionStatus}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Online Users</span>
                  <span className="text-sm font-medium text-blue-600">{users.length}</span>
                </div>
                {mediaDeviceStatus && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Microphone</span>
                      <span className={`text-sm font-medium ${mediaDeviceStatus.hasAudio ? 'text-green-600' : 'text-red-600'}`}>
                        {mediaDeviceStatus.hasAudio ? '✅ Available' : '❌ Not found'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Camera</span>
                      <span className={`text-sm font-medium ${mediaDeviceStatus.hasVideo ? 'text-green-600' : 'text-yellow-600'}`}>
                        {mediaDeviceStatus.hasVideo ? '✅ Available' : '⚠️ Not found'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Call Status */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Call Status</h3>
              {currentCall ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    {currentCall.type === 'video' ? (
                      <Video className="w-8 h-8 text-green-600" />
                    ) : (
                      <Phone className="w-8 h-8 text-green-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    {currentCall.status === 'calling' ? '📞 Calling...' : 
                     currentCall.status === 'ringing' ? '📞 Ringing...' :
                     currentCall.status === 'connected' ? '✅ Connected' : '🔄 Connecting...'}
                  </p>
                  <p className="font-medium text-gray-800">
                    {currentCall.otherUser.username}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {currentCall.type === 'video' ? 'Video Call' : 'Voice Call'}
                  </p>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <Phone className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No active calls</p>
                </div>
              )}
            </div>

            {/* Debug Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Debug Info</h3>
              <div className="space-y-2 text-xs text-gray-600">
                <div>Local Stream: {localStream ? '✅ Active' : '❌ None'}</div>
                <div>Remote Stream: {remoteStream ? '✅ Active' : '❌ None'}</div>
                {localStream && (
                  <div>
                    Local Tracks: 
                    🎤 {localStream.getAudioTracks().length} audio, 
                    📹 {localStream.getVideoTracks().length} video
                  </div>
                )}
                {remoteStream && (
                  <div>
                    Remote Tracks: 
                    🎤 {remoteStream.getAudioTracks().length} audio, 
                    📹 {remoteStream.getVideoTracks().length} video
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCall
          caller={incomingCall.from}
          callType={incomingCall.callType}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}
      
      {/* Call Interface */}
      {currentCall && currentCall.status === 'connected' && currentCall.otherUser && (
        <CallInterface
          localStream={localStream}
          remoteStream={remoteStream}
          callType={currentCall.type}
          otherUser={currentCall.otherUser}
          onEndCall={handleEndCall}
        />
      )}
    </div>
  );
};

export default Dashboard;