// openmanus/client/src/api/api.ts
import axios, { AxiosRequestConfig, AxiosError } from 'axios';

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  validateStatus: (status) => {
    return status >= 200 && status < 300;
  },
});

let accessToken: string | null = null;

export default api;
