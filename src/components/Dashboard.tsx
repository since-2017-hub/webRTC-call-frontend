import React, { useState, useEffect } from 'react';
import { LogOut, Phone, Video, Users, Wifi, WifiOff } from 'lucide-react';
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
  
  const showNotification = (message: string) => {
    console.log('📢 Notification:', message);
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };
  
  useEffect(() => {
    if (!user) return;
    
    console.log('🔌 Connecting user:', user.username);
    const socket = socketService.connect(user.id, user.username);
    
    socket.on('connect', () => {
      console.log('✅ Connected to server');
      setConnectionStatus('connected');
      showNotification('Connected to server');
    });
    
    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setConnectionStatus('disconnected');
      showNotification('Disconnected from server');
    });
    
    socket.on('join_success', (data) => {
      console.log('🎉 Join success:', data.onlineUsers.length, 'users online');
      setUsers(data.onlineUsers);
      showNotification(data.message);
    });
    
    socket.on('users_updated', (onlineUsers: User[]) => {
      console.log('👥 Users updated:', onlineUsers.length, 'online');
      setUsers(onlineUsers);
    });
    
    socket.on('incoming_call', async (data) => {
      console.log('📞 Incoming call from:', data.from.username, 'Type:', data.callType);
      setIncomingCall(data);
      showNotification(`Incoming ${data.callType} call from ${data.from.username}`);
      
      try {
        await webrtcService.initializePeerConnection();
        await webrtcService.setRemoteDescription(data.offer);
        
        webrtcService.setOnRemoteStream((stream) => {
          console.log('🎵 Remote stream received in incoming call');
          setRemoteStream(stream);
        });
        
        webrtcService.setOnIceCandidate((candidate) => {
          socket.emit('ice_candidate', {
            to: data.from.id,
            candidate,
          });
        });
      } catch (error) {
        console.error('❌ Error handling incoming call:', error);
        showNotification('Error handling incoming call');
      }
    });
    
    socket.on('call_accepted', async (data) => {
      console.log('✅ Call accepted:', data.callId);
      try {
        await webrtcService.setRemoteDescription(data.answer);
        
        // Update call status to connected
        setCurrentCall(prev => prev ? {
          ...prev,
          id: data.callId,
          status: 'connected'
        } : null);
        
        showNotification('Call connected');
      } catch (error) {
        console.error('❌ Error handling call acceptance:', error);
        showNotification('Error connecting call');
      }
    });
    
    socket.on('call_rejected', () => {
      console.log('❌ Call rejected');
      setCurrentCall(null);
      webrtcService.hangup();
      setLocalStream(null);
      setRemoteStream(null);
      showNotification('Call was rejected');
    });
    
    socket.on('call_ended', () => {
      console.log('📴 Call ended');
      setCurrentCall(null);
      setIncomingCall(null);
      webrtcService.hangup();
      setLocalStream(null);
      setRemoteStream(null);
      showNotification('Call ended');
    });
    
    socket.on('ice_candidate', async (data) => {
      try {
        await webrtcService.addIceCandidate(data.candidate);
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    });
    
    socket.on('call_status', (data) => {
      console.log('📊 Call status:', data.status);
      if (data.status === 'user_offline') {
        showNotification('User is offline');
        setCurrentCall(null);
      } else if (data.status === 'ringing') {
        setCurrentCall(prev => prev ? { ...prev, status: 'ringing' } : null);
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
      console.log(`📞 Starting ${callType} call to:`, targetUser.username);
      
      // Check media devices
      const { hasAudio, hasVideo } = await WebRTCService.checkMediaDevices();
      
      if (!hasAudio) {
        showNotification('No microphone found');
        return;
      }
      
      if (callType === 'video' && !hasVideo) {
        showNotification('No camera found');
        return;
      }
      
      // Set call state immediately with proper otherUser
      setCurrentCall({
        type: callType,
        otherUser: targetUser, // ✅ This ensures otherUser exists
        status: 'calling'
      });
      
      await webrtcService.initializePeerConnection();
      const stream = await webrtcService.getLocalStream(callType === 'video');
      setLocalStream(stream);
      
      webrtcService.addLocalStream(stream);
      
      webrtcService.setOnRemoteStream((stream) => {
        console.log('🎵 Remote stream received during outgoing call');
        setRemoteStream(stream);
      });
      
      webrtcService.setOnIceCandidate((candidate) => {
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('ice_candidate', {
            to: targetUser.id,
            candidate,
          });
        }
      });
      
      const offer = await webrtcService.createOffer();
      
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('call_user', {
          to: targetUser.id,
          from: user,
          callType,
          offer,
        });
        
        showNotification(`Calling ${targetUser.username}...`);
      }
    } catch (error) {
      console.error('❌ Error starting call:', error);
      setCurrentCall(null);
      showNotification('Failed to start call. Please check your permissions.');
    }
  };
  
  const handleAcceptCall = async () => {
    try {
      console.log('✅ Accepting call from:', incomingCall.from.username);
      
      const stream = await webrtcService.getLocalStream(incomingCall.callType === 'video');
      setLocalStream(stream);
      
      webrtcService.addLocalStream(stream);
      
      const answer = await webrtcService.createAnswer();
      
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('accept_call', {
          callId: incomingCall.callId,
          answer,
        });
      }
      
      // Set current call with proper otherUser from incoming call
      setCurrentCall({
        id: incomingCall.callId,
        type: incomingCall.callType,
        otherUser: incomingCall.from, // ✅ This ensures otherUser exists
        status: 'connected'
      });
      
      setIncomingCall(null);
      showNotification('Call accepted');
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      showNotification('Failed to accept call');
    }
  };
  
  const handleRejectCall = () => {
    console.log('❌ Rejecting call');
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('reject_call', {
        callId: incomingCall.callId,
      });
    }
    
    setIncomingCall(null);
    webrtcService.hangup();
    showNotification('Call rejected');
  };
  
  const handleEndCall = () => {
    console.log('📴 Ending call');
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
    showNotification('Call ended');
  };
  
  const handleLogout = () => {
    console.log('👋 Logging out');
    webrtcService.hangup();
    socketService.disconnect();
    logout();
  };
  
  if (!user) return null;
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in">
          {notification}
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
                <div className="flex items-center space-x-2">
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
                Status
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
                  <p className="text-sm text-gray-600">
                    {currentCall.status === 'calling' ? 'Calling...' : 
                     currentCall.status === 'ringing' ? 'Ringing...' :
                     currentCall.status === 'connected' ? 'In call' : 'Connecting...'}
                  </p>
                  <p className="font-medium text-gray-800">
                    {currentCall.otherUser.username}
                  </p>
                </div>
              ) : (
                <p className="text-center text-gray-500">No active calls</p>
              )}
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
      
      {/* Call Interface - Only show when connected and otherUser exists */}
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