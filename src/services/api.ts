import axios from "axios";
const API_BASE_URL = `${process.env.VITE_API_URL}/api`;

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
    const response = await axios.post(
      `${API_BASE_URL}/login`,
      { username: username, password: password },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: false,
      }
    );

    // if (!response.ok) {
    //   throw new Error("Login failed");
    // }
    console.log(response);
    return response.data;
  },

  getUsers: async (): Promise<User[]> => {
    const response = await axios.get(`${API_BASE_URL}/users`);
    return response.data;
  },
};
