import React from 'react';
import { Phone, Video, User, Circle } from 'lucide-react';
import { User as UserType } from '../services/api';

interface UserListProps {
  users: UserType[];
  currentUser: UserType;
  onCall: (user: UserType, callType: 'audio' | 'video') => void;
}

const UserList: React.FC<UserListProps> = ({ users, currentUser, onCall }) => {
  const otherUsers = users.filter(user => user.id !== currentUser.id);
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <User className="w-5 h-5 mr-2" />
          Online Users ({otherUsers.length})
        </h3>
      </div>
      
      <div className="divide-y divide-gray-200">
        {otherUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No other users online</p>
          </div>
        ) : (
          otherUsers.map((user) => (
            <div key={user.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    {user.isOnline && (
                      <Circle className="w-3 h-3 text-green-500 fill-current absolute -bottom-1 -right-1 bg-white rounded-full" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800">{user.username}</h4>
                    <p className="text-sm text-green-600">Online</p>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => onCall(user, 'audio')}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                    title="Voice Call"
                  >
                    <Phone className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onCall(user, 'video')}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="Video Call"
                  >
                    <Video className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UserList;