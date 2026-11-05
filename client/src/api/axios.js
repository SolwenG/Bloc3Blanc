import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5030';

const API = axios.create({
    baseURL: `${API_URL}/api`,
});

// Add a request interceptor to attach JWT token
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default API;
