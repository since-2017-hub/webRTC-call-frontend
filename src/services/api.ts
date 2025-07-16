import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL;

export interface User {
  id: string;
  username: string;
  isOnline: boolean;
  socketId?: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export const api = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    if (!response.ok) {
      throw new Error('Login failed');
    }
    
    return response.json();
  },
  
  getUsers: async (): Promise<User[]> => {
    const response = await fetch(`${API_BASE_URL}/users`);
    return response.json();
  },
};
